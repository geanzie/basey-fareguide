'use client'

import { useState, useEffect } from 'react'

interface Notification {
  id: string
  type: 'incident' | 'evidence' | 'priority' | 'backup' | 'system'
  title: string
  message: string
  timestamp: string
  read: boolean
  actionRequired?: boolean
  incidentId?: string
}

interface NotificationCenterProps {
  onNotificationClick?: (notification: Notification) => void
}

const NotificationCenter = ({ onNotificationClick }: NotificationCenterProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)

  useEffect(() => {
    fetchNotifications()
    // Set up periodic check for new notifications (reduced frequency to avoid spam)
    const interval = setInterval(fetchNotifications, 60000) // Check every 60 seconds instead of 30
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const unread = notifications.filter(n => !n.read).length
    setUnreadCount(unread)
  }, [notifications])

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/enforcer/notifications', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications || [])
      } else if (response.status === 404) {
        // API endpoint not implemented yet, use mock data
        const mockNotifications: Notification[] = [
          {
            id: '1',
            type: 'incident',
            title: 'New High-Priority Incident',
            message: 'Reckless driving reported near Basey Elementary School',
            timestamp: new Date().toISOString(),
            read: false,
            actionRequired: true,
            incidentId: 'INC001'
          },
          {
            id: '2',
            type: 'evidence',
            title: 'Evidence Uploaded',
            message: 'New video evidence submitted for incident #INC002',
            timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
            read: false,
            incidentId: 'INC002'
          },
          {
            id: '3',
            type: 'priority',
            title: 'Incident Escalated',
            message: 'Incident #INC003 marked as high priority',
            timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
            read: true,
            incidentId: 'INC003'
          },
          {
            id: '4',
            type: 'system',
            title: 'System Update',
            message: 'New enforcement features available',
            timestamp: new Date(Date.now() - 60 * 60000).toISOString(),
            read: true
          }
        ]
        setNotifications(mockNotifications)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      const token = localStorage.getItem('token')
      await fetch(`/api/enforcer/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      setNotifications(prev => prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, read: true }
          : notification
      ))
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token')
      await fetch('/api/enforcer/notifications/read-all', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      setNotifications(prev => prev.map(notification => ({ ...notification, read: true })))
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'incident': return '🚨'
      case 'evidence': return '📁'
      case 'priority': return '⚠️'
      case 'backup': return '🆘'
      case 'system': return '⚙️'
      default: return '📢'
    }
  }

  const getNotificationColor = (type: string, read: boolean) => {
    const opacity = read ? 'opacity-60' : ''
    
    switch (type) {
      case 'incident': return `bg-red-50 border-red-200 ${opacity}`
      case 'evidence': return `bg-blue-50 border-blue-200 ${opacity}`
      case 'priority': return `bg-orange-50 border-orange-200 ${opacity}`
      case 'backup': return `bg-purple-50 border-purple-200 ${opacity}`
      case 'system': return `bg-gray-50 border-gray-200 ${opacity}`
      default: return `bg-gray-50 border-gray-200 ${opacity}`
    }
  }

  const formatTime = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diff = now.getTime() - time.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id)
    }
    if (onNotificationClick) {
      onNotificationClick(notification)
    }
    setShowNotifications(false)
  }

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="relative p-2 text-gray-600 hover:text-gray-800 transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-5-5V9a6 6 0 10-12 0v3l-5 5h5m7 0v1a3 3 0 01-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {showNotifications && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${getNotificationColor(notification.type, notification.read)}`}
                >
                  <div className="flex items-start space-x-3">
                    <span className="text-xl flex-shrink-0">{getNotificationIcon(notification.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className={`text-sm font-medium ${notification.read ? 'text-gray-600' : 'text-gray-900'}`}>
                          {notification.title}
                        </h4>
                        {notification.actionRequired && !notification.read && (
                          <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                            Action Required
                          </span>
                        )}
                      </div>
                      <p className={`text-sm mt-1 ${notification.read ? 'text-gray-500' : 'text-gray-700'}`}>
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-400">
                          {formatTime(notification.timestamp)}
                        </span>
                        {notification.incidentId && (
                          <span className="text-xs text-blue-600 font-medium">
                            #{notification.incidentId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">
                <span className="text-4xl mb-2 block">📭</span>
                <p>No notifications</p>
              </div>
            )}
          </div>
          
          {notifications.length > 5 && (
            <div className="p-4 border-t border-gray-200 text-center">
              <button className="text-sm text-blue-600 hover:text-blue-800">
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default NotificationCenter