#!/usr/bin/env node

import { render } from 'ink'
import App from './components/App'

const instance = render(<App />)
await instance.waitUntilExit()
