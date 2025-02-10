const isDevelopment = import.meta.env.DEV

export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args)
    }
  },
  error: (...args: any[]) => {
    if (isDevelopment) {
      console.error(...args)
    }
  },
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args)
    }
  },
  group: (...args: any[]) => {
    if (isDevelopment) {
      console.group(...args)
    }
  },
  groupEnd: () => {
    if (isDevelopment) {
      console.groupEnd()
    }
  }
} 