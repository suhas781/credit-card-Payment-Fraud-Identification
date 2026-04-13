import { useCallback, useEffect, useRef, useState } from 'react'
import { wsBaseUrl } from '../api/client'

interface UseWebSocketResult<T> {
  isConnected: boolean
  lastMessage: T | null
  send: (data: string) => void
}

export function useWebSocket<T = unknown>(
  enabled: boolean,
): UseWebSocketResult<T> {
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<T | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef(0)

  const send = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data)
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      wsRef.current?.close()
      wsRef.current = null
      setIsConnected(false)
      return
    }

    let closed = false
    const url = wsBaseUrl()

    const connect = () => {
      if (closed) return
      const ws = new WebSocket(url)
      wsRef.current = ws
      ws.onopen = () => {
        setIsConnected(true)
        reconnectRef.current = 0
      }
      ws.onmessage = (ev) => {
        try {
          setLastMessage(JSON.parse(ev.data as string) as T)
        } catch {
          setLastMessage(null)
        }
      }
      ws.onclose = () => {
        setIsConnected(false)
        if (!closed) {
          const delay = Math.min(30000, 1000 * 2 ** reconnectRef.current)
          reconnectRef.current += 1
          window.setTimeout(connect, delay)
        }
      }
      ws.onerror = () => {
        ws.close()
      }
    }

    connect()
    const ping = window.setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send('ping')
      }
    }, 25_000)

    return () => {
      closed = true
      window.clearInterval(ping)
      wsRef.current?.close()
      wsRef.current = null
      setIsConnected(false)
    }
  }, [enabled])

  return { isConnected, lastMessage, send }
}
