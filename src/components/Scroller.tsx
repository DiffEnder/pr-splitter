import { ReactNode, useEffect, useState } from 'react'
import { Box, useStdout } from 'ink'

interface ScrollerProps {
  width: number
  height: number
  children: ReactNode
  [key: string]: any
}

const Scroller = ({ width, height, children, ...props }: ScrollerProps) => {
  const [scrollY, setScrollY] = useState(0)
  const [scrollYDir, setScrollYDir] = useState(1)

  useEffect(() => {
    if (scrollY + scrollYDir < -7 || scrollY + scrollYDir > 7) {
      setScrollYDir(scrollYDir * -1)
      return
    }

    setTimeout(() => setScrollY(scrollY + scrollYDir), 100)
  }, [scrollY, scrollYDir])

  return (
    <Box overflow="hidden" width={width} height={height} {...props}>
      <Box flexDirection="column" marginTop={-scrollY} flexGrow={0} flexShrink={0}>
        {children}
      </Box>
    </Box>
  )
}

const AmazeBoxRenderer = ({ children }: { children: ReactNode }) => {
  const { stdout } = useStdout()

  return (
    <Scroller height={stdout.rows} width={stdout.columns}>
      {children}
    </Scroller>
  )
}

export { Scroller, AmazeBoxRenderer }
