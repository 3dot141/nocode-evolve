"""sow v2 script.py 的单元测试。

运行：python3 -m unittest skills/sow/sow-reference/test_script.py
"""
import io
import os
import shutil
import sys
import tempfile
import unittest
from datetime import datetime
from unittest import mock

# Make script.py importable as a module
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import script  # noqa: E402


FIXED_DT = datetime(2026, 5, 14, 13, 42)


def make_vault(root):
    """在 root 下建出 Memory/{01-Inbox,02-Inputs,05-Outputs} 三子目录的 fixture。"""
    memory = os.path.join(root, script.MEMORY_SUBDIR)
    for layer_dir in script.LAYER_DIR_MAP.values():
        os.makedirs(os.path.join(memory, layer_dir), exist_ok=True)
    return memory


class TestPathFragments(unittest.TestCase):
    def test_format_created_date(self):
        self.assertEqual(script.format_created_date(FIXED_DT), "2026-05-14 13:42")

    def test_format_yymm(self):
        self.assertEqual(script.format_yymm(FIXED_DT), "2605")

    def test_format_yymmdd(self):
        self.assertEqual(script.format_yymmdd(FIXED_DT), "260514")

    def test_format_yymm_jan(self):
        # 月份补零边界
        dt = datetime(2026, 1, 3, 0, 0)
        self.assertEqual(script.format_yymm(dt), "2601")
        self.assertEqual(script.format_yymmdd(dt), "260103")


class TestPermalink(unittest.TestCase):
    def test_format_and_length(self):
        permalink = script.compute_permalink("命令设计", "2026-05-14 13:42")
        self.assertTrue(permalink.startswith("posts/"))
        hex_part = permalink[len("posts/"):]
        self.assertEqual(len(hex_part), 32)
        self.assertTrue(all(c in "0123456789abcdef" for c in hex_part))

    def test_idempotent(self):
        a = script.compute_permalink("命令设计", "2026-05-14 13:42")
        b = script.compute_permalink("命令设计", "2026-05-14 13:42")
        self.assertEqual(a, b)

    def test_different_title_produces_different_hash(self):
        a = script.compute_permalink("命令设计", "2026-05-14 13:42")
        b = script.compute_permalink("命令设计 v2", "2026-05-14 13:42")
        self.assertNotEqual(a, b)

    def test_separator_prevents_collision(self):
        # 实现用 "\n" 分隔；任意 (title, date) 拼接出的 seed 都唯一——零冲突
        a = script.compute_permalink("A", "B|C")
        b = script.compute_permalink("A|B", "C")
        self.assertNotEqual(a, b)


class TestRenderFrontmatter(unittest.TestCase):
    def test_field_order_and_basic_shape(self):
        out = script.render_frontmatter(
            summary="围绕意图做了什么",
            created_date="2026-05-14 13:42",
            modified_date="2026-05-14 13:42",
            permalink="posts/abc123",
        )
        self.assertTrue(out.startswith("---\n"))
        self.assertTrue(out.endswith("---\n"))
        idx_aliases = out.index("aliases:")
        idx_draft = out.index("draft:")
        idx_tags = out.index("tags:")
        idx_summary = out.index("summary:")
        idx_source = out.index("source:")
        idx_created = out.index("created_date:")
        idx_modified = out.index("modified_date:")
        idx_permalink = out.index("permalink:")
        self.assertLess(idx_aliases, idx_draft)
        self.assertLess(idx_draft, idx_tags)
        self.assertLess(idx_tags, idx_summary)
        self.assertLess(idx_summary, idx_source)
        self.assertLess(idx_source, idx_created)
        self.assertLess(idx_created, idx_modified)
        self.assertLess(idx_modified, idx_permalink)

    def test_static_fields(self):
        out = script.render_frontmatter(
            summary="x",
            created_date="2026-05-14 13:42",
            modified_date="2026-05-14 13:42",
            permalink="posts/abc",
        )
        self.assertIn("aliases: []", out)
        self.assertIn("draft: false", out)
        # tags 三层共用 [ai-distill], 不按 layer 分 (W6 决议)
        self.assertIn("tags: [ai-distill]", out)
        self.assertIn("source: chat-distill", out)

    def test_summary_with_yaml_special_chars(self):
        # summary 含 yaml 敏感字符（冒号、井号、引号、反斜杠）必须正确 escape
        out = script.render_frontmatter(
            summary='含 ":" 和 "#" 和 "引号" 的 summary',
            created_date="2026-05-14 13:42",
            modified_date="2026-05-14 13:42",
            permalink="posts/abc",
        )
        self.assertIn(r'summary: "含 \"', out)

    def test_round_trip_parse(self):
        # 拼出来的 frontmatter 行数 = --- + 8 字段 + ---
        out = script.render_frontmatter(
            summary="正常摘要",
            created_date="2026-05-14 13:42",
            modified_date="2026-05-14 13:42",
            permalink="posts/abc",
        )
        non_empty_lines = [l for l in out.splitlines() if l.strip()]
        self.assertEqual(len(non_empty_lines), 10)
        for line in non_empty_lines[1:-1]:
            self.assertRegex(line, r"^[a-z_]+:\s")


class TestPathOps(unittest.TestCase):
    """v2: 路径拼接 + 子目录校验 + mkdir 涉及 layer 维度。"""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.memory_root = make_vault(self.tmp)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_build_memory_root(self):
        self.assertEqual(
            script.build_memory_root(self.tmp),
            os.path.join(self.tmp, "Memory"),
        )

    def test_build_target_path_inbox(self):
        path = script.build_target_path(
            self.memory_root, "inbox", "2605", "260514", "命令设计")
        expected = os.path.join(
            self.memory_root, "01-Inbox", "2605", "260514-命令设计.md")
        self.assertEqual(path, expected)

    def test_build_target_path_inputs(self):
        path = script.build_target_path(
            self.memory_root, "inputs", "2605", "260514", "命令设计")
        expected = os.path.join(
            self.memory_root, "02-Inputs", "2605", "260514-命令设计.md")
        self.assertEqual(path, expected)

    def test_build_target_path_outputs(self):
        path = script.build_target_path(
            self.memory_root, "outputs", "2605", "260514", "命令设计")
        expected = os.path.join(
            self.memory_root, "05-Outputs", "2605", "260514-命令设计.md")
        self.assertEqual(path, expected)

    def test_check_layer_subdirs_all_present(self):
        self.assertEqual(script.check_layer_subdirs(self.memory_root), [])

    def test_check_layer_subdirs_missing_one(self):
        shutil.rmtree(os.path.join(self.memory_root, "02-Inputs"))
        missing = script.check_layer_subdirs(self.memory_root)
        self.assertEqual(len(missing), 1)
        self.assertTrue(missing[0].endswith("02-Inputs"))

    def test_check_layer_subdirs_missing_multiple(self):
        shutil.rmtree(os.path.join(self.memory_root, "01-Inbox"))
        shutil.rmtree(os.path.join(self.memory_root, "05-Outputs"))
        missing = script.check_layer_subdirs(self.memory_root)
        self.assertEqual(len(missing), 2)

    def test_ensure_yymm_dir_creates_when_missing(self):
        yymm_dir = os.path.join(self.memory_root, "01-Inbox", "2605")
        self.assertFalse(os.path.exists(yymm_dir))
        script.ensure_yymm_dir(self.memory_root, "inbox", "2605")
        self.assertTrue(os.path.isdir(yymm_dir))

    def test_ensure_yymm_dir_idempotent(self):
        script.ensure_yymm_dir(self.memory_root, "inbox", "2605")
        script.ensure_yymm_dir(self.memory_root, "inbox", "2605")
        self.assertTrue(os.path.isdir(
            os.path.join(self.memory_root, "01-Inbox", "2605")))

    def test_check_collision_no_file(self):
        path = os.path.join(self.tmp, "absent.md")
        self.assertFalse(script.target_exists(path))

    def test_check_collision_existing_file(self):
        path = os.path.join(self.tmp, "existing.md")
        with open(path, "w") as f:
            f.write("x")
        self.assertTrue(script.target_exists(path))


class TestMainIntegration(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.memory_root = make_vault(self.tmp)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _run_main(self, argv, env_override=None):
        """跑 main()，可选 patch env。返回 (exit, stdout, stderr)。"""
        env = dict(os.environ)
        if env_override is not None:
            for k, v in env_override.items():
                if v is None:
                    env.pop(k, None)
                else:
                    env[k] = v

        stdout_buf = io.StringIO()
        stderr_buf = io.StringIO()
        with mock.patch.dict(os.environ, env, clear=True), \
             mock.patch.object(sys, "stdout", stdout_buf), \
             mock.patch.object(sys, "stderr", stderr_buf):
            exit_code = script.main(argv)
        return exit_code, stdout_buf.getvalue(), stderr_buf.getvalue()

    # -- exit 2: env error --------------------------------------------------

    def test_env_missing_exit_2(self):
        exit_code, _, stderr = self._run_main(
            ["--layer", "outputs", "--intent", "x", "--title", "x", "--summary", "x"],
            env_override={"USER_VAULT_PATH": None},
        )
        self.assertEqual(exit_code, 2)
        self.assertIn("USER_VAULT_PATH", stderr)

    def test_env_not_a_dir_exit_2(self):
        # env 指向不存在的路径
        exit_code, _, stderr = self._run_main(
            ["--layer", "outputs", "--intent", "x", "--title", "x", "--summary", "x"],
            env_override={"USER_VAULT_PATH": "/nonexistent/path/xyz"},
        )
        self.assertEqual(exit_code, 2)
        self.assertIn("USER_VAULT_PATH", stderr)

    # -- exit 3: subdir missing --------------------------------------------

    def test_missing_subdir_exit_3(self):
        shutil.rmtree(os.path.join(self.memory_root, "02-Inputs"))
        exit_code, _, stderr = self._run_main(
            ["--layer", "inputs", "--intent", "x", "--title", "x", "--summary", "x"],
            env_override={"USER_VAULT_PATH": self.tmp},
        )
        self.assertEqual(exit_code, 3)
        self.assertIn("missing subdir", stderr)
        self.assertIn("02-Inputs", stderr)

    # -- exit 3: mkdir failed (子类型) -------------------------------------

    def test_mkdir_failure_exit_3(self):
        # mock makedirs 抛 OSError → exit 3, stderr 子类型 "mkdir failed"
        with mock.patch("script.datetime") as mock_dt, \
             mock.patch("script.os.makedirs",
                        side_effect=OSError("perm denied")):
            mock_dt.now.return_value = FIXED_DT
            exit_code, _, stderr = self._run_main(
                ["--layer", "inbox", "--intent", "x", "--title", "x", "--summary", "x"],
                env_override={"USER_VAULT_PATH": self.tmp},
            )
        self.assertEqual(exit_code, 3)
        self.assertIn("mkdir failed", stderr)
        self.assertIn("perm denied", stderr)

    # -- exit 1: path conflict ---------------------------------------------

    def test_path_conflict_exit_1(self):
        with mock.patch("script.datetime") as mock_dt:
            mock_dt.now.return_value = FIXED_DT
            yymm_dir = os.path.join(self.memory_root, "05-Outputs", "2605")
            os.makedirs(yymm_dir)
            existing = os.path.join(yymm_dir, "260514-命令设计.md")
            with open(existing, "w") as f:
                f.write("preexisting")
            exit_code, _, stderr = self._run_main(
                ["--layer", "outputs", "--intent", "x", "--title", "命令设计", "--summary", "x"],
                env_override={"USER_VAULT_PATH": self.tmp},
            )
        self.assertEqual(exit_code, 1)
        self.assertIn("已存在", stderr)

    # -- exit 4: invalid --layer -------------------------------------------

    def test_invalid_layer_argparse_exit(self):
        # argparse choices 校验非法 layer; SystemExit code 2 是 argparse 默认行为
        # (不是我们的 exit 4——4 是为"参数缺/串错"留的, argparse choices 已先报错)
        with self.assertRaises(SystemExit) as cm:
            self._run_main(
                ["--layer", "cards", "--intent", "x", "--title", "x", "--summary", "x"],
                env_override={"USER_VAULT_PATH": self.tmp},
            )
        # argparse 错误退 code 2 (argparse 内置), main() 不会跑到. 这是预期行为
        # —— layer 非法在 parse_args 阶段就被拦, 走 argparse 默认错误流而非我们的 exit 4
        self.assertEqual(cm.exception.code, 2)

    def test_missing_layer_argparse_exit(self):
        # --layer 必填, 缺失 argparse 报错 SystemExit
        with self.assertRaises(SystemExit):
            self._run_main(
                ["--intent", "x", "--title", "x", "--summary", "x"],
                env_override={"USER_VAULT_PATH": self.tmp},
            )

    # -- exit 0: happy path -------------------------------------------------

    def test_happy_path_stdout_protocol_inbox(self):
        with mock.patch("script.datetime") as mock_dt:
            mock_dt.now.return_value = FIXED_DT
            exit_code, stdout, stderr = self._run_main(
                ["--layer", "inbox", "--intent", "测试意图", "--title", "命令设计",
                 "--summary", "围绕意图做了什么"],
                env_override={"USER_VAULT_PATH": self.tmp},
            )
        self.assertEqual(exit_code, 0)
        self.assertEqual(stderr, "")

        lines = stdout.split("\n")
        target_idx = None
        for i, line in enumerate(lines):
            if line.startswith("TARGET_PATH: "):
                target_idx = i
                break
        self.assertIsNotNone(target_idx, "stdout missing 'TARGET_PATH: ' prefix line")
        assert target_idx is not None  # narrow type for Pyright

        # TARGET_PATH 前面应有空行作分隔
        self.assertEqual(lines[target_idx - 1], "")
        # 空行之前应是 ---（frontmatter 末尾）
        self.assertEqual(lines[target_idx - 2], "---")

        # path 值落 01-Inbox/...
        target_path = lines[target_idx][len("TARGET_PATH: "):]
        expected = os.path.join(
            self.memory_root, "01-Inbox", "2605", "260514-命令设计.md")
        self.assertEqual(target_path, expected)

    def test_happy_path_inputs_layer(self):
        with mock.patch("script.datetime") as mock_dt:
            mock_dt.now.return_value = FIXED_DT
            exit_code, stdout, _ = self._run_main(
                ["--layer", "inputs", "--intent", "x", "--title", "T",
                 "--summary", "s"],
                env_override={"USER_VAULT_PATH": self.tmp},
            )
        self.assertEqual(exit_code, 0)
        self.assertIn(
            os.path.join(self.memory_root, "02-Inputs", "2605", "260514-T.md"),
            stdout,
        )

    def test_happy_path_outputs_layer(self):
        with mock.patch("script.datetime") as mock_dt:
            mock_dt.now.return_value = FIXED_DT
            exit_code, stdout, _ = self._run_main(
                ["--layer", "outputs", "--intent", "x", "--title", "T",
                 "--summary", "s"],
                env_override={"USER_VAULT_PATH": self.tmp},
            )
        self.assertEqual(exit_code, 0)
        self.assertIn(
            os.path.join(self.memory_root, "05-Outputs", "2605", "260514-T.md"),
            stdout,
        )

    def test_happy_path_tags_unified(self):
        # tags 三层共用 [ai-distill], 不按 layer 分 (W6 决议).
        # 三 layer 都应输出 `tags: [ai-distill]`.
        for layer in ("inbox", "inputs", "outputs"):
            with mock.patch("script.datetime") as mock_dt:
                mock_dt.now.return_value = FIXED_DT
                _, stdout, _ = self._run_main(
                    ["--layer", layer, "--intent", "x",
                     "--title", f"T-{layer}", "--summary", "s"],
                    env_override={"USER_VAULT_PATH": self.tmp},
                )
            self.assertIn("tags: [ai-distill]", stdout,
                          f"layer={layer} should have unified tags")

    def test_happy_path_does_not_write_file(self):
        # 脚本只算 path，不真正写文件——Write 是 AI 的活
        with mock.patch("script.datetime") as mock_dt:
            mock_dt.now.return_value = FIXED_DT
            self._run_main(
                ["--layer", "outputs", "--intent", "x", "--title", "命令设计",
                 "--summary", "x"],
                env_override={"USER_VAULT_PATH": self.tmp},
            )
        target = os.path.join(
            self.memory_root, "05-Outputs", "2605", "260514-命令设计.md")
        self.assertFalse(os.path.exists(target),
                         "script must NOT write target file (AI's job)")
        # 但 yymm 子目录应已创建
        self.assertTrue(os.path.isdir(
            os.path.join(self.memory_root, "05-Outputs", "2605")))


if __name__ == "__main__":
    unittest.main()
