import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import notificationService from '../services/notificationService';
import Icon from './Icon';

const TYPE_ICON = {
  LEAVE_NEW_REQUEST: 'pencil-line',
  LEAVE_APPROVED: 'check',
  LEAVE_REJECTED: 'x',
  ATTENDANCE_MISSING_CLOCKOUT: 'clock',
};

// Where a notification should take the user: the page holding the record, with
// the record's id in `?highlight=` so that page can flash it. Attendance also
// needs the date, since it loads a month at a time.
const targetOf = (n) => {
  if (!n.relatedId) return null;
  if (n.relatedEntity === 'LEAVE') return `/leave?highlight=${n.relatedId}`;
  if (n.relatedEntity === 'ATTENDANCE') {
    const date = n.meta?.date ? `&date=${n.meta.date}` : '';
    return `/attendance?highlight=${n.relatedId}${date}`;
  }
  return null;
};

export default function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef(null);
  const btnRef = useRef(null);
  // Below this width the panel is too wide to hang off the bell, so it becomes
  // a viewport-centred sheet instead. Null = anchored to the bell as usual.
  const [sheetTop, setSheetTop] = useState(null);

  const load = async () => {
    try {
      const data = await notificationService.getMine();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // silent — notifications are non-critical
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const reposition = () => {
      const narrow = window.innerWidth < 720;
      if (!narrow || !btnRef.current) {
        setSheetTop(null);
        return;
      }
      setSheetTop(btnRef.current.getBoundingClientRect().bottom + 8);
    };
    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

  const handleItemClick = async (n) => {
    const target = targetOf(n);
    if (target) {
      setOpen(false);
      navigate(target);
    }
    if (!n.isRead) {
      await notificationService.markRead(n.id);
      setNotifications((list) => list.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
  };

  const handleMarkAll = async () => {
    await notificationService.markAllRead();
    setNotifications((list) => list.map((x) => ({ ...x, isRead: true })));
    setUnreadCount(0);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn btn-ghost btn-icon relative"
        aria-label={t('common.notifications')}
      >
        <Icon name="bell" className="w-4 h-4" />
        {unreadCount > 0 && (
          <span
            className="absolute rounded-full"
            style={{ top: 6, insetInlineEnd: 7, width: 6, height: 6, background: 'var(--color-accent)' }}
          />
        )}
      </button>

      {open && (
        <div
          className={
            sheetTop !== null
              ? 'fixed left-1/2 -translate-x-1/2 w-[calc(100vw-24px)] max-w-[380px] max-h-[70vh] overflow-y-auto no-scrollbar fade-in card'
              : 'absolute end-0 mt-2 w-80 max-h-96 overflow-y-auto no-scrollbar fade-in card'
          }
          style={{
            zIndex: 50,
            background: 'var(--color-bg)',
            boxShadow: 'var(--shadow-lg)',
            padding: 0,
            ...(sheetTop !== null ? { top: sheetTop } : {}),
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 sticky top-0" style={{ borderBottom: '1px solid var(--color-divider)', background: 'var(--color-bg)' }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 500 }}>{t('common.notifications')}</span>
            {unreadCount > 0 && (
              <button className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 6px' }} onClick={handleMarkAll}>
                {t('common.markAllRead')}
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="text-center py-6" style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>{t('common.noNotifications')}</p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleItemClick(n)}
                className="w-full text-start px-4 py-3 flex gap-2.5"
                style={{ borderBottom: '1px solid color-mix(in srgb, var(--color-text) 6%, transparent)', opacity: n.isRead ? 0.6 : 1 }}
              >
                <Icon name={TYPE_ICON[n.type] || 'bell'} className="w-4 h-4 mt-0.5" style={{ color: 'var(--color-accent)' }} />
                <span className="flex-1 min-w-0">
                  <span className="block" style={{ fontSize: 13, fontWeight: 500 }}>{n.title}</span>
                  <span className="block mt-0.5" style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{n.message}</span>
                  <span className="block mt-1" style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </span>
                </span>
                {!n.isRead && <span className="shrink-0 mt-1 rounded-full" style={{ width: 6, height: 6, background: 'var(--color-accent)' }} />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
