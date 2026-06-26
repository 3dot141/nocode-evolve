#!/usr/bin/env node
/**
 * vendor-sync.mjs — 按 vendor-integration.json 同步 vendor 内容到 skills/ agents/ commands/ references/
 *
 * 用法:
 *   node scripts/vendor-sync.mjs                  # 执行同步（所有 vendor）
 *   node scripts/vendor-sync.mjs --dry-run        # 只打印，不执行
 *   node scripts/vendor-sync.mjs --check          # 检查是否一致，不一致 exit 1
 *   node scripts/vendor-sync.mjs superpowers      # 只同步指定 vendor
 */
import { readFileSync, cpSync, rmSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..')
const VENDOR_ROOT = join(ROOT, 'vendor')

const argv = process.argv.slice(2)
const DRY_RUN = argv.includes('--dry-run')
const CHECK = argv.includes('--check')
const filterVendor = argv.find(a => !a.startsWith('--'))

let dirty = false

const VENDORS = readdirSync(VENDOR_ROOT, { withFileTypes: true })
  .filter(d => d.isDirectory() && existsSync(join(VENDOR_ROOT, d.name, 'vendor-integration.json')))
  .map(d => d.name)
  .filter(name => !filterVendor || name === filterVendor)

if (VENDORS.length === 0) {
  console.log(filterVendor ? `vendor '${filterVendor}' 不存在或无 vendor-integration.json` : '无 vendor')
  process.exit(filterVendor ? 1 : 0)
}

for (const vendorName of VENDORS) {
  console.log(`\n=== ${vendorName} ===`)
  const vendorDir = join(VENDOR_ROOT, vendorName)
  const config = JSON.parse(readFileSync(join(vendorDir, 'vendor-integration.json'), 'utf8'))

  // --- Skills ---
  if (config.skills) {
    syncCategory({
      entries: config.skills,
      vendorSubdir: 'skills',
      targetDir: join(ROOT, 'skills'),
      vendorDir,
      label: 'skills',
    })
  }

  // --- Agents ---
  if (config.agents) {
    syncCategory({
      entries: config.agents,
      vendorSubdir: 'agents',
      targetDir: join(ROOT, 'agents'),
      vendorDir,
      label: 'agents',
      fileExt: '.md',
    })
  }

  // --- Commands ---
  if (config.commands) {
    syncCategory({
      entries: config.commands,
      vendorSubdir: 'commands',
      targetDir: join(ROOT, 'commands'),
      vendorDir,
      label: 'commands',
      fileExt: '.md',
    })
  }
}

if (CHECK) {
  if (dirty) {
    console.log('\nvendor-sync --check: 不一致，跑 node scripts/vendor-sync.mjs 同步')
    process.exit(1)
  } else {
    console.log('\nvendor-sync --check: 一致')
  }
}

// ---

function syncCategory({ entries, vendorSubdir, targetDir, vendorDir, label, fileExt }) {
  for (const [name, rule] of Object.entries(entries)) {
    if (name.startsWith('_')) continue // _all, _rest 等通配符跳过

    const vendorSrc = fileExt
      ? join(vendorDir, vendorSubdir, name + fileExt)
      : join(vendorDir, vendorSubdir, name)
    const targetPath = fileExt
      ? join(targetDir, name + fileExt)
      : join(targetDir, name)

    const isDir = !fileExt

    if (!existsSync(vendorSrc)) {
      console.warn(`  WARN: vendor ${label}/${name} 不存在`)
      continue
    }

    const action = rule.action
    const rel = `${label}/${name}${fileExt || '/'}`

    switch (action) {
      case 'keep-as-skill':
      case 'keep-as-agent':
      case 'keep-as-command': {
        if (CHECK) {
          if (!existsSync(targetPath)) {
            console.log(`  MISSING: ${rel} (should exist)`)
            dirty = true
          }
          break
        }
        if (DRY_RUN) {
          console.log(`  COPY: ${rel}`)
          break
        }
        if (isDir) {
          cpSync(vendorSrc, targetPath, { recursive: true })
        } else {
          mkdirSync(dirname(targetPath), { recursive: true })
          cpSync(vendorSrc, targetPath)
        }
        console.log(`  ✓ ${rel} (${action})`)
        break
      }

      case 'extract-references': {
        for (const { src, dst } of rule.extract || []) {
          const srcPath = join(isDir ? vendorSrc : dirname(vendorSrc), src)
          const dstPath = join(ROOT, dst)

          if (CHECK) {
            if (!existsSync(dstPath)) {
              console.log(`  MISSING: ${dst} (should exist)`)
              dirty = true
            }
            continue
          }
          if (DRY_RUN) {
            console.log(`  EXTRACT: ${dst}`)
            continue
          }
          mkdirSync(dirname(dstPath), { recursive: true })
          cpSync(srcPath, dstPath)
          console.log(`  ✓ ${dst} (extract from ${name})`)
        }
        // 删除 target 目录/文件（如果存在）
        if (existsSync(targetPath)) {
          if (CHECK) {
            console.log(`  STALE: ${rel} (should not exist)`)
            dirty = true
          } else if (DRY_RUN) {
            console.log(`  REMOVE: ${rel}`)
          } else {
            rmSync(targetPath, { recursive: true })
            console.log(`  ✗ ${rel} (removed)`)
          }
        }
        break
      }

      case 'absorb': {
        if (rule.done) {
          // 已完成的 absorb，只在 verbose 时展示
          if (CHECK) {
            console.log(`  ✓ ${rel} → ${rule.absorb_into} (absorbed: ${rule.done_reason || 'done'})`)
          }
        } else {
          // 未完成的 absorb，展示融合指引供 AI 处理
          console.log(`  ⊕ TODO: ${rel} → ${rule.absorb_into}`)
          if (rule.how) {
            console.log(`    how: ${rule.how}`)
          }
          if (CHECK) dirty = true
        }
        // 删除 target skill/agent 目录（如果存在，absorb 不保留独立目录）
        if (existsSync(targetPath)) {
          if (CHECK) {
            console.log(`  STALE: ${rel} (should not exist, absorbed)`)
            dirty = true
          } else if (DRY_RUN) {
            console.log(`  REMOVE: ${rel}`)
          } else {
            rmSync(targetPath, { recursive: true })
            console.log(`  ✗ ${rel} (removed, absorbed into ${rule.absorb_into})`)
          }
        }
        break
      }

      case 'skip': {
        if (existsSync(targetPath)) {
          if (CHECK) {
            console.log(`  STALE: ${rel} (should not exist)`)
            dirty = true
          } else if (DRY_RUN) {
            console.log(`  REMOVE: ${rel}`)
          } else {
            rmSync(targetPath, { recursive: true })
            console.log(`  ✗ ${rel} (removed, skip)`)
          }
        }
        break
      }

      default:
        console.warn(`  WARN: unknown action '${action}' for ${name}`)
    }
  }
}
