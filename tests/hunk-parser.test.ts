import { readFileSync } from 'fs-extra'
import path from 'path'
import { describe, test, expect } from 'vitest'
import { parseDiff } from '../src/redux/thunks/hunkThunksHelpers'
import { TextHunk } from '../src/types'
import dotenv from 'dotenv'

dotenv.config()

// Real git diff output from your example
const REAL_DIFF_OUTPUT = `diff --git a/package.json b/package.json
index 9d9e8d0..0d3b19a 100644
--- a/package.json
+++ b/package.json
@@ -28,6 +28,7 @@
     "@ai-sdk/openai": "^1.3.23",
     "@octokit/rest": "^22.0.0",
     "@octokit/types": "^14.1.0",
+    "@types/uuid": "^10.0.0",
     "@xenova/transformers": "^2.17.2",
     "ai": "^4.3.17",
     "chalk": "4.1.2",
@@ -41,6 +42,7 @@
     "ramda": "^0.29.0",
     "simple-git": "^3.25.0",
     "tmp": "^0.2.3",
+    "uuid": "^11.1.0",
     "zod": "^3.25.76"
   },
   "devDependencies": {
diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
index 3e63177..53ae729 100644
--- a/pnpm-lock.yaml
+++ b/pnpm-lock.yaml
@@ -23,6 +23,9 @@ importers:
      '@octokit/types':
        specifier: ^14.1.0
        version: 14.1.0
+      '@types/uuid':
+        specifier: ^10.0.0
+        version: 10.0.0
       '@xenova/transformers':
        specifier: ^2.17.2
        version: 2.17.2
@@ -62,6 +65,9 @@ importers:
      tmp:
        specifier: ^0.2.3
        version: 0.2.3
+      uuid:
+        specifier: ^11.1.0
+        version: 11.1.0
       zod:
        specifier: ^3.25.76
        version: 3.25.76`

const OTHER_REAL_DIFF_OUTPUT = `diff --git a/components/Output.tsx b/components/Output.tsx
index ac611ad..580a42b 100644
--- a/components/Output.tsx
+++ b/components/Output.tsx
@@ -13,11 +13,9 @@ const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })
 export const Output = ({
   output,
   html,
-  filePath,
 }: {
   output: OutputSerializable
   html: string[] | undefined
-  filePath: string
 }) => {
   // The presence of \`html\` indicates that the diff is prerendered by the diffing algorithm
   // so we can just display it
@@ -25,8 +23,7 @@ export const Output = ({
 
   const mime = output.data.mime
   if (mime === Mime.plotly) return <Plotly {...output.data.data} />
-  if (mime === Mime.textMarkdown)
-    return <MarkdownWithSyntaxHighlighting text={output.data.data} filePath={filePath} />
+  if (mime === Mime.textMarkdown) return <MarkdownWithSyntaxHighlighting text={output.data.data} />
   if (mime === Mime.textLatex)
     return (
       <h3>
@@ -34,13 +31,7 @@ export const Output = ({
       </h3>
     )
   if (mime === Mime.applicationJavaScript)
-    return (
-      <MarkdownWithSyntaxHighlighting
-        language="javascript"
-        text={output.data.data}
-        filePath={filePath}
-      />
-    )
+    return <MarkdownWithSyntaxHighlighting language="javascript" text={output.data.data} />
   if (mime === Mime.textHTML) return <HTMLOutput html={output.data.data} />
   if (mime === Mime.imageSVGXML)
     return <div dangerouslySetInnerHTML={{ __html: output.data.data }} />`

// Simpler diff for basic testing
const SIMPLE_DIFF_OUTPUT = `diff --git a/test.js b/test.js
index abc123..def456 100644
--- a/test.js
+++ b/test.js
@@ -10,3 +10,4 @@ function example() {
   console.log('original line')
-  return false
+  return true
+  console.log('added line')
   // context line`

describe('Hunk Parser', () => {
  describe('parseUnifiedDiff', () => {
    test('should parse simple diff with one file and one hunk', () => {
      const allHunks = parseDiff(SIMPLE_DIFF_OUTPUT)
      const hunks = allHunks.filter((hunk): hunk is TextHunk => hunk.type === 'text')
      expect(allHunks.length).toEqual(hunks.length)

      expect(hunks[0]).toMatchObject({
        type: 'text',
        filePath: 'test.js',
        linesRemoved: 3,
        linesAdded: 4,
        operation: 'modified',
      })

      // Check that content includes the hunk header and diff lines (backward compatibility)
      expect(hunks[0].content).toContain('@@ -10,3 +10,4 @@ function example() {')
      expect(hunks[0].content).toContain("   console.log('original line')")
      expect(hunks[0].content).toContain('-  return false')
      expect(hunks[0].content).toContain('+  return true')
      expect(hunks[0].content).toContain("+  console.log('added line')")

      // Check that completePatch contains proper headers
      expect(hunks[0].completePatch).toContain('diff --git a/test.js b/test.js')
      expect(hunks[0].completePatch).toContain('index abc123..def456 100644')
      expect(hunks[0].completePatch).toContain('--- a/test.js')
      expect(hunks[0].completePatch).toContain('+++ b/test.js')
      expect(hunks[0].completePatch).toContain('@@ -10,3 +10,4 @@ function example() {')
      expect(hunks[0].completePatch).toContain('-  return false')
      expect(hunks[0].completePatch).toContain('+  return true')
    })

    test('should parse real diff with multiple files and hunks', () => {
      const allHunks = parseDiff(REAL_DIFF_OUTPUT)
      const hunks = allHunks.filter((hunk): hunk is TextHunk => hunk.type === 'text')

      // Should find multiple hunks across different files
      expect(hunks.length).toBeGreaterThan(1)

      // Check we have hunks for both files
      const files = [...new Set(hunks.map((h) => h.filePath))]
      expect(files).toContain('package.json')
      expect(files).toContain('pnpm-lock.yaml')

      // Check package.json hunks
      const packageHunks = hunks.filter((h) => h.filePath === 'package.json')
      expect(packageHunks.length).toEqual(2)

      // Verify first package.json hunk (adding @types/uuid)
      const firstPackageHunk = packageHunks[0]
      expect(firstPackageHunk.content).toContain('+    "@types/uuid": "^10.0.0",')

      // Check that content structure is preserved
      packageHunks.forEach((hunk) => {
        expect(hunk.content).toMatch(/^@@ .+ @@/)
        expect(hunk.content).toContain('+')
      })
    })

    test('should handle empty or invalid diff input', () => {
      expect(() => parseDiff('')).toThrow()
      expect(() => parseDiff('not a diff')).toThrow()
      expect(() => parseDiff('diff --git without proper format')).toThrow()
    })

    test('should correctly parse hunk headers with different formats', () => {
      const diffWithContext = `diff --git a/file.js b/file.js
index abc123..def456 100644
--- a/file.js
+++ b/file.js
@@ -15,2 +15,3 @@ function myFunction() {
   existing line
+  new line
   another line`

      const allHunks = parseDiff(diffWithContext)
      const hunks = allHunks.filter((hunk): hunk is TextHunk => hunk.type === 'text')
      expect(hunks).toHaveLength(1)
      expect(hunks[0].linesRemoved).toBe(2)
      expect(hunks[0].linesAdded).toBe(3)
    })

    test('should handle single line changes without count', () => {
      const singleLineDiff = `diff --git a/file.js b/file.js
index abc123..def456 100644
--- a/file.js
+++ b/file.js
@@ -1 +1 @@
-old line
+new line`

      const allHunks = parseDiff(singleLineDiff)
      const hunks = allHunks.filter((hunk): hunk is TextHunk => hunk.type === 'text')
      expect(hunks).toHaveLength(1)
      expect(hunks[0].linesRemoved).toBe(1)
      expect(hunks[0].linesAdded).toBe(1)
    })

    test('should parse multiple hunks in same file correctly', () => {
      const multiHunkDiff = `diff --git a/file.js b/file.js
index abc123..def456 100644
--- a/file.js
+++ b/file.js
@@ -1,3 +1,3 @@
 first line
-second line
+modified second line
 third line
@@ -10,2 +10,3 @@ function test() {
 existing line
+new line added
 last line`

      const allHunks = parseDiff(multiHunkDiff)
      const hunks = allHunks.filter((hunk): hunk is TextHunk => hunk.type === 'text')
      expect(hunks).toHaveLength(2)

      // First hunk
      expect(hunks[0].content).toContain('-second line')
      expect(hunks[0].content).toContain('+modified second line')

      // Second hunk
      expect(hunks[1].content).toContain('+new line added')
    })

    test('should correctly parse your real package.json changes', () => {
      const allHunks = parseDiff(REAL_DIFF_OUTPUT)
      const hunks = allHunks.filter((hunk): hunk is TextHunk => hunk.type === 'text')

      // Find package.json hunks
      const packageHunks = hunks.filter((h) => h.filePath === 'package.json')

      // Should have exactly 2 hunks for the 2 dependency additions
      expect(packageHunks).toHaveLength(2)

      // First hunk: adding @types/uuid
      const firstHunk = packageHunks[0]
      expect(firstHunk.linesRemoved).toBe(6)
      expect(firstHunk.linesAdded).toBe(7)
      expect(firstHunk.content).toContain('+    "@types/uuid": "^10.0.0",')

      // Second hunk: adding uuid
      const secondHunk = packageHunks[1]
      expect(secondHunk.content).toContain('+    "uuid": "^11.1.0",')
    })

    test('should handle new file creation correctly', () => {
      const newFileDiff = `diff --git a/new-file.js b/new-file.js
new file mode 100644
index 0000000..abc123
--- /dev/null
+++ b/new-file.js
@@ -0,0 +1,3 @@
+console.log('new file')
+export default {}
+// end`

      const allHunks = parseDiff(newFileDiff)
      const hunks = allHunks.filter((hunk): hunk is TextHunk => hunk.type === 'text')
      expect(hunks).toHaveLength(1)

      const hunk = hunks[0]
      expect(hunk.type).toBe('text')
      expect(hunk.filePath).toBe('new-file.js')
      expect(hunk.operation).toBe('added')
      expect(hunk.linesAdded).toBe(3)

      // Check completePatch contains new file headers
      expect(hunk.completePatch).toContain('diff --git a/new-file.js b/new-file.js')
      expect(hunk.completePatch).toContain('new file mode 100644')
      expect(hunk.completePatch).toContain('index 0000000..abc123')
      expect(hunk.completePatch).toContain('--- /dev/null')
      expect(hunk.completePatch).toContain('+++ b/new-file.js')
      expect(hunk.completePatch).toContain('@@ -0,0 +1,3 @@')
      expect(hunk.completePatch).toContain("+console.log('new file')")
    })

    test('should handle file deletion correctly', () => {
      const deletedFileDiff = `diff --git a/old-file.js b/old-file.js
deleted file mode 100644
index abc123..0000000
--- a/old-file.js
+++ /dev/null
@@ -1,2 +0,0 @@
-console.log('deleting this')
-export default {}`

      const allHunks = parseDiff(deletedFileDiff)
      const hunks = allHunks.filter((hunk): hunk is TextHunk => hunk.type === 'text')
      expect(hunks).toHaveLength(1)

      const hunk = hunks[0]
      expect(hunk.type).toBe('text')
      expect(hunk.filePath).toBe('old-file.js')
      expect(hunk.operation).toBe('deleted')
      expect(hunk.linesRemoved).toBe(2)

      // Check completePatch contains deleted file headers
      expect(hunk.completePatch).toContain('diff --git a/old-file.js b/old-file.js')
      expect(hunk.completePatch).toContain('deleted file mode 100644')
      expect(hunk.completePatch).toContain('index abc123..0000000')
      expect(hunk.completePatch).toContain('--- a/old-file.js')
      expect(hunk.completePatch).toContain('+++ /dev/null')
      expect(hunk.completePatch).toContain('@@ -1,2 +0,0 @@')
      expect(hunk.completePatch).toContain("-console.log('deleting this')")
    })

    test('completePatch should be valid patch format', () => {
      const allHunks = parseDiff(SIMPLE_DIFF_OUTPUT)
      const hunks = allHunks.filter((hunk): hunk is TextHunk => hunk.type === 'text')
      expect(hunks).toHaveLength(1)

      const completePatch = hunks[0].completePatch

      // Should start with diff header
      expect(completePatch).toMatch(/^diff --git/)

      // Should contain all required patch elements in order
      const lines = completePatch.split('\n')
      expect(lines[0]).toMatch(/^diff --git/)
      expect(lines[1]).toMatch(/^index/)
      expect(lines[2]).toMatch(/^---/)
      expect(lines[3]).toMatch(/^\+\+\+/)
      expect(lines[4]).toMatch(/^@@.*@@/)

      // Should contain the actual changes
      expect(completePatch).toContain('-  return false')
      expect(completePatch).toContain('+  return true')

      // Debug: log the complete patch to see what it looks like
      console.log('Complete patch content:')
      console.log(completePatch)
    })

    test('should debug multi-file diff parsing', () => {
      const allHunks = parseDiff(REAL_DIFF_OUTPUT)
      const hunks = allHunks.filter((hunk): hunk is TextHunk => hunk.type === 'text')

      // Pick the first hunk to examine
      const firstHunk = hunks[0]
      console.log('First hunk complete patch:')
      console.log(firstHunk.completePatch)
      console.log('---')

      // Verify patch structure
      const lines = firstHunk.completePatch.split('\n')
      expect(lines[0]).toMatch(/^diff --git/)
    })

    test('should handle complex multi-hunk diff correctly', () => {
      const allHunks = parseDiff(OTHER_REAL_DIFF_OUTPUT)
      const hunks = allHunks.filter((hunk): hunk is TextHunk => hunk.type === 'text')

      // Should parse all hunks from the same file
      expect(hunks.length).toBe(3)
      expect(hunks.every((hunk) => hunk.filePath === 'components/Output.tsx')).toBe(true)

      // Each hunk should have valid patch structure
      hunks.forEach((hunk, index) => {
        const lines = hunk.completePatch.split('\n')
        expect(lines[0]).toMatch(/^diff --git/)
        expect(lines[1]).toMatch(/^index/)
        expect(lines[2]).toMatch(/^---/)
        expect(lines[3]).toMatch(/^\+\+\+/)
        expect(lines[4]).toMatch(/^@@.*@@/)

        // Ensure patch ends with exactly one newline (required by git apply)
        expect(hunk.completePatch).toMatch(/[^\n]\n$/)
        expect(hunk.completePatch).not.toMatch(/\n\n$/) // No double newlines
      })

      // Verify specific hunk content
      expect(hunks[0].content).toContain('-  filePath,')
      expect(hunks[1].content).toContain('textMarkdown')
      expect(hunks[2].content).toContain('applicationJavaScript')
    })

    test('should parse binary patch with mixed file types correctly', () => {
      const BINARY_PATCH = `diff --git a/lib/features/env/envSelectors.ts b/lib/features/env/envSelectors.ts
index 6335e62..4ebc5e6 100644
--- a/lib/features/env/envSelectors.ts
+++ b/lib/features/env/envSelectors.ts
@@ -32,6 +32,6 @@ export const getGitHubDotComUrl = createSelector(getGithubBaseUrl, (githubBaseUr
   githubBaseUrlToGithubDotComUrl(githubBaseUrl),
 )

-export const getAppName = createSelector(getEnv, (env) => env.APP_NAME || 'DiffEnder')
+export const getAppName = createSelector(getEnv, (env) => env.APP_NAME || 'GitNotebooks')

 export const getDeploymentAllowsAi = createSelector(getEnv, (env) => env.AI_ENABLED)
diff --git a/public/diffender/favicon-16x16.png b/public/diffender/favicon-16x16.png
new file mode 100644
index 0000000000000000000000000000000000000000..09d68dffba154947d957c690bd08d774b7f191a0
GIT binary patch
literal 625
zcmV-%0*?KOP)<h;3K|Lk000e1NJLTq000mG000mO1^@s6AM^iV00001b5ch_0olnc
ze*gdg1ZP1_K>z@;j|==^1poj5AY({UO#lFTCIA3{ga82g0001h=l}q9FaQARU;qF*
zm;eA5aGbhPJOBUy24YJi\`L;xTFAOIjcq4HAz000SaNLh0L01FcU01FcV0GgZ_00007
zbV*G\`2k8eG6(%qx_>q|a00Fg0L_t(I%VpEOYZOrw1@PY+H>7f~5D_cEuRp-n#>PS{
zM2I$~5+N2^2q|nVL>n7Pl_3!eEi6Vvv=BiNL{JP0CVqefB#MHopji||v->ReZZe6t
znmO;BbMHO#Cc)y^;gsYOd$1R~u^pTAtBrX)$3r|$NoW0Jol|FQWF3y<G\`6CJ6v7@B
zu_3UGCA\`NaOcxl&ICfyDA%<VrhkGGT!Pyy_;UW%t4N(X00?YAyKRVCiZ}7UvMG\${9
z4B9w\`4-M>PKZ7)iiw#Y$2&az?@)p$Ci0k+*dC(6x&*OC%ETG#8gEu(X*l\`Z$FoSM6
zS!aBK&e+JH(c45f1$Y2AW9+lIh0XD0mN1c7D3YABqnN^>va0X4!tE)(MrcDgg_9_8
z0uzZxIcwt#zTp\`ZVelPyunm\`SA+qR6ZeujkpTI8M9t2-NS=HSb>t|e~VkOh0tm;Kf
z$CMpRg{Da~i)*pQiaIa94(\`iUyc&SZ24z(*#prWZRnyN4oF8;wJAtyQKgWO3xEITm
zKNv5oy4}>Y{9iLTf-C(Xvqnyz){=|0Kv~tftm-G&j~mkJ9oE)A2pN^v\`JR=E00000
LNkvXXu0mjfY%%tD

literal 0
HcmV?d00001
diff --git a/public/diffender/favicon-16x16.png b/public/diffender/favicon-16x14.png
similarity index 100%
rename from public/diffender/favicon-16x16.png
rename to public/diffender/favicon-16x14.png

`
      const hunks = parseDiff(BINARY_PATCH)

      // Should find all hunks including binary and text files
      expect(hunks.length).toBe(3)

      // Check that we have hunks for the correct files
      const files = [...new Set(hunks.map((h) => h.filePath))]
      expect(files).toContain('lib/features/env/envSelectors.ts')
      expect(files).toContain('public/diffender/favicon-16x16.png')

      // Test text file modification
      const textFileHunk = hunks.find((h) => h.filePath === 'lib/features/env/envSelectors.ts')
      expect(textFileHunk).toBeDefined()
      expect(textFileHunk?.type).toBe('text')
      expect(textFileHunk?.operation).toBe('modified')
      if (textFileHunk?.type === 'text') {
        expect(textFileHunk.content).toContain(
          "-export const getAppName = createSelector(getEnv, (env) => env.APP_NAME || 'DiffEnder')",
        )
        expect(textFileHunk.content).toContain(
          "+export const getAppName = createSelector(getEnv, (env) => env.APP_NAME || 'GitNotebooks')",
        )
      }

      // Test binary file handling
      const binaryFileHunk = hunks.find((h) => h.filePath === 'public/diffender/favicon-16x16.png')
      expect(binaryFileHunk).toBeDefined()
      expect(binaryFileHunk?.type).toBe('binary')
      expect(binaryFileHunk?.operation).toBe('added')
      expect(binaryFileHunk?.completePatch).toContain('new file mode 100644')
      expect(binaryFileHunk?.completePatch).toContain('GIT binary patch')
      expect(binaryFileHunk?.completePatch).toContain('literal 625')

      const binaryFileHunkThatWasRenamed = hunks.find(
        (h) => h.filePath === 'public/diffender/favicon-16x14.png',
      )
      expect(binaryFileHunkThatWasRenamed?.completePatch)
        .toContain(`diff --git a/public/diffender/favicon-16x16.png b/public/diffender/favicon-16x14.png
similarity index 100%
rename from public/diffender/favicon-16x16.png
rename to public/diffender/favicon-16x14.png`)

      // Verify all hunks have valid complete patches
      hunks.forEach((hunk) => {
        expect(hunk.completePatch).toMatch(/^diff --git/)
        if (hunk.type === 'text') {
          expect(hunk.completePatch).toContain(
            '@@ -32,6 +32,6 @@ export const getGitHubDotComUrl = createSelector(getGithubBaseUrl, (githubBaseUr',
          )
          expect(hunk.completePatch).toContain(
            "-export const getAppName = createSelector(getEnv, (env) => env.APP_NAME || 'DiffEnder')",
          )
          expect(hunk.completePatch).toContain(
            "+export const getAppName = createSelector(getEnv, (env) => env.APP_NAME || 'GitNotebooks')",
          )
        }
      })
    })

    test('should parse git-notebooks-pull-140.patch correctly', async () => {
      const GIT_NOTEBOOKS_PATCH = readFileSync(
        path.join(__dirname, 'patches', 'git-notebooks-pull-140.patch'),
        'utf8',
      )

      const allHunks = parseDiff(GIT_NOTEBOOKS_PATCH)
      const storeHunk = allHunks.filter((hunk) => hunk.filePath === 'lib/store.ts')
      expect(storeHunk.length).toBe(3)
      expect(storeHunk[0].completePatch).toBe(`diff --git a/lib/store.ts b/lib/store.ts
index 255adc37..8213c039 100644
--- a/lib/store.ts
+++ b/lib/store.ts
@@ -1,4 +1,4 @@
-import { configureStore } from '@reduxjs/toolkit'
+import { configureStore, isRejected, isRejectedWithValue } from '@reduxjs/toolkit'
 import { apiSlice } from './features/api/apiSlice'
 import blobReducer from './features/blob/blobSlice'
 import commentReducer from './features/comment/commentSlice'
`)
      expect(storeHunk[1].completePatch).toBe(`diff --git a/lib/store.ts b/lib/store.ts
index 255adc37..8213c039 100644
--- a/lib/store.ts
+++ b/lib/store.ts
@@ -15,6 +15,7 @@ import userReducer from './features/user/userSlice'
 import repoSettingsReducer from './features/repoSettings/repoSettingsSlice'
 import repoReducer from './features/repo/repoSlice'
 import pullRequestsReducer from './features/pullRequests/pullRequestsSlice'
+import { loggerMiddleware } from './middleware'
 
 export const makeStore = () => {
   return configureStore({
`)
      expect(storeHunk[2].completePatch).toBe(`diff --git a/lib/store.ts b/lib/store.ts
index 255adc37..8213c039 100644
--- a/lib/store.ts
+++ b/lib/store.ts
@@ -36,7 +37,8 @@ export const makeStore = () => {
       user: userReducer,
       [apiSlice.reducerPath]: apiSlice.reducer,
     },
-    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(apiSlice.middleware),
+    middleware: (getDefaultMiddleware) =>
+      getDefaultMiddleware().concat(apiSlice.middleware, loggerMiddleware),
   })
 }

`)
    })
  })
})
