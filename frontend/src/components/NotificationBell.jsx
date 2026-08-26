import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useNotifications } from '../context/NotificationContext'
import { useLang } from '../context/LangContext'

function timeAgo(dateStr, lang) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return lang === 'en' ? 'just now' : 'भर्खर'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const { lang } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div className="notif-bell" ref={ref}>
      <button className="notif-bell__trigger" onClick={() => setOpen((o) => !o)} aria-label="Notifications">
        🔔
        {unreadCount > 0 && <span className="notif-bell__badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown__header">
            <span>{lang === 'en' ? 'Notifications' : 'सूचनाहरू'}</span>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead}>{lang === 'en' ? 'Mark all read' : 'सबै पढियो चिन्ह लगाउनुहोस्'}</button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="notif-dropdown__empty">
              {lang === 'en' ? 'No notifications yet.' : 'अहिलेसम्म कुनै सूचना छैन।'}
            </p>
          ) : (
            <div className="notif-dropdown__list">
              {notifications.slice(0, 15).map((n) => {
                const target = n.type === 'order_status' && n.order_id
                  ? `/order/${n.order_id}`
                  : n.type === 'price_drop' && n.product_id
                    ? `/product/${n.product_id}`
                    : null

                const body = (
                  <>
                    <p className="notif-item__title">{n.title}</p>
                    <p className="notif-item__message">{n.message}</p>
                    <span className="notif-item__time">{timeAgo(n.created_at, lang)}</span>
                  </>
                )

                return (
                  <div
                    key={n.id}
                    className={`notif-item ${n.is_read ? '' : 'notif-item--unread'}`}
                    onClick={() => !n.is_read && markAsRead(n.id)}
                  >
                    {target ? (
                      <Link to={target} onClick={() => setOpen(false)}>
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default NotificationBell
