import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const NotificationContext = createContext()

export function NotificationProvider({ children }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifications(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Live updates: new price-drop / order-status notifications appear
  // instantly without a page refresh.
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const unreadCount = notifications.filter((n) => !n.is_read).length

  async function markAsRead(id) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  }

  async function markAllAsRead() {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id)
    if (unreadIds.length === 0) return
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds)
  }

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, loading, markAsRead, markAllAsRead, refresh: fetchNotifications }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  return useContext(NotificationContext)
}
