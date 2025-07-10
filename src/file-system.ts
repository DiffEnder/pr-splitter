import { tmpdir } from 'os'
import { join } from 'path'
import { promises as fs } from 'fs'

export const createTempDirectory = async (): Promise<string> =>
  fs.mkdtemp(join(tmpdir(), 'pr-splitter-'))
