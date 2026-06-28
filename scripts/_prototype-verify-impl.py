#!/usr/bin/env python3
"""
Playwright-based prototype verification for pd-ui Step 8.

Phase 1: Screenshot each HTML file (full page).
Phase 2: Run interaction scenarios (click/hover/focus) and screenshot each step.

Output: screenshots/ dir + verify-report.json + human-readable stdout summary.
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import pathname2url

from playwright.sync_api import sync_playwright


def file_url(path: str) -> str:
    return "file://" + pathname2url(os.path.abspath(path))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("proto_dir", help="Directory containing HTML prototype files")
    parser.add_argument("--interactions", "-i", help="JSON file with interaction scenarios")
    parser.add_argument("--out", "-o", default="", help="Output directory (default: <proto_dir>/verify-output)")
    parser.add_argument("--viewport", default="1440x900", help="Viewport size WxH")
    args = parser.parse_args()

    proto_dir = Path(args.proto_dir).resolve()
    if not proto_dir.is_dir():
        print(f"Error: prototype directory not found: {proto_dir}", file=sys.stderr)
        sys.exit(1)

    vp_w, vp_h = [int(x) for x in args.viewport.split("x")]
    out_dir = Path(args.out).resolve() if args.out else proto_dir / "verify-output"
    ss_dir = out_dir / "screenshots"
    ss_dir.mkdir(parents=True, exist_ok=True)

    html_files = sorted(f.name for f in proto_dir.iterdir() if f.suffix == ".html")
    if not html_files:
        print(f"Error: no HTML files found in {proto_dir}", file=sys.stderr)
        sys.exit(1)

    interactions = []
    if args.interactions:
        with open(args.interactions, "r", encoding="utf-8") as f:
            interactions = json.load(f)

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "protoDir": str(proto_dir),
        "files": [],
        "interactions": [],
        "summary": {},
    }
    total_screenshots = 0
    errors = 0

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": vp_w, "height": vp_h})

        # --- Phase 1: page screenshots ---
        print(f"\n📸 Phase 1: Page screenshots ({len(html_files)} files)\n")

        for fname in html_files:
            fpath = proto_dir / fname
            url = file_url(str(fpath))
            entry = {"file": fname, "url": url, "screenshots": [], "errors": [], "metadata": {}}

            page = context.new_page()
            js_errors = []
            page.on("pageerror", lambda err: js_errors.append(str(err)))

            try:
                page.goto(url, wait_until="networkidle", timeout=10000)
                page.wait_for_timeout(500)

                ss_path = str(ss_dir / f"{Path(fname).stem}.png")
                page.screenshot(path=ss_path, full_page=True)
                entry["screenshots"].append(ss_path)
                total_screenshots += 1
                print(f"  ✓ {fname} → {Path(ss_path).name}")

                if js_errors:
                    for e in js_errors:
                        entry["errors"].append(f"JS error: {e}")
                    errors += len(js_errors)

                # Collect metadata
                title = page.title()
                links = page.eval_on_selector_all(
                    "a[href]",
                    "els => els.map(a => a.getAttribute('href')).filter(h => h && h.endsWith('.html'))",
                )
                dialog_count = page.eval_on_selector_all("dialog", "els => els.length")
                button_count = page.eval_on_selector_all("button", "els => els.length")
                entry["metadata"] = {
                    "title": title,
                    "internalLinks": links,
                    "dialogCount": dialog_count,
                    "buttonCount": button_count,
                }

            except Exception as ex:
                entry["errors"].append(f"Load error: {ex}")
                errors += 1
                print(f"  ✗ {fname} — {ex}")

            page.close()
            report["files"].append(entry)

        # --- Phase 2: interaction verification ---
        if interactions:
            print(f"\n🖱️  Phase 2: Interaction verification ({len(interactions)} scenarios)\n")

            for scenario in interactions:
                s_file = scenario["file"]
                s_label = scenario.get("label", s_file)
                fpath = proto_dir / s_file

                if not fpath.exists():
                    entry = {
                        "label": s_label,
                        "file": s_file,
                        "status": "error",
                        "errors": ["File not found"],
                        "screenshots": [],
                    }
                    report["interactions"].append(entry)
                    errors += 1
                    print(f"  ✗ [{s_label}] {s_file} — file not found")
                    continue

                page = context.new_page()
                url = file_url(str(fpath))
                entry = {"label": s_label, "file": s_file, "status": "pass", "screenshots": [], "errors": []}

                try:
                    page.goto(url, wait_until="networkidle", timeout=10000)
                    page.wait_for_timeout(300)

                    for step in scenario.get("steps", []):
                        action = step.get("action", "click")
                        selector = step.get("selector", "")
                        ss_name = step.get("screenshot", "")

                        try:
                            if action == "click":
                                page.click(selector, timeout=5000)
                            elif action == "hover":
                                page.hover(selector, timeout=5000)
                            elif action == "focus":
                                page.focus(selector)
                            elif action == "wait":
                                page.wait_for_timeout(step.get("ms", 500))

                            if ss_name:
                                page.wait_for_timeout(300)
                                ss_path = str(ss_dir / f"{ss_name}.png")
                                page.screenshot(path=ss_path, full_page=True)
                                entry["screenshots"].append({"name": ss_name, "path": ss_path})
                                total_screenshots += 1
                                print(f'  ✓ [{s_label}] {action} "{selector}" → {ss_name}.png')

                        except Exception as step_err:
                            step_id = ss_name or action
                            entry["errors"].append(f'Step "{step_id}": {step_err}')
                            entry["status"] = "fail"
                            errors += 1
                            print(f'  ✗ [{s_label}] {action} "{selector}" — {step_err}')

                except Exception as ex:
                    entry["status"] = "error"
                    entry["errors"].append(f"Load error: {ex}")
                    errors += 1
                    print(f"  ✗ [{s_label}] — {ex}")

                page.close()
                report["interactions"].append(entry)

        browser.close()

    # --- Summary ---
    report["summary"] = {
        "totalFiles": len(html_files),
        "totalScreenshots": total_screenshots,
        "totalInteractions": len(interactions),
        "interactionsPassed": sum(1 for i in report["interactions"] if i["status"] == "pass"),
        "interactionsFailed": sum(1 for i in report["interactions"] if i["status"] != "pass"),
        "errors": errors,
    }

    report_path = out_dir / "verify-report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"\n{'─' * 50}")
    print("📋 Summary")
    print(f"   Files:         {report['summary']['totalFiles']}")
    print(f"   Screenshots:   {report['summary']['totalScreenshots']}")
    if interactions:
        print(f"   Interactions:  {report['summary']['interactionsPassed']}/{report['summary']['totalInteractions']} passed")
    print(f"   Errors:        {report['summary']['errors']}")
    print(f"   Report:        {report_path}")
    print(f"   Screenshots:   {ss_dir}/")
    print(f"{'─' * 50}\n")

    sys.exit(1 if errors > 0 else 0)


if __name__ == "__main__":
    main()
