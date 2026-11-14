import { useEffect } from 'react'
import { APP_NAME } from '../app/config'

export function useTitle(title: string): void {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME
  }, [title])
}
