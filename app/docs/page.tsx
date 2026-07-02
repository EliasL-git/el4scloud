import fs from 'fs'
import path from 'path'
import DocsTabs from './tabs'

const markdownFiles = [
  'overview.md',
  'upload.md',
  'download.md',
  'ai.md',
  'support.md',
]

export default function DocsPage() {
  const contents: Record<string, string> = {}
  for (const file of markdownFiles) {
    contents[file] = fs.readFileSync(
      path.join(process.cwd(), 'documentation', file),
      'utf-8',
    )
  }

  return <DocsTabs contents={contents} />
}
