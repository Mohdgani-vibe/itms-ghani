import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Search, Bell, ChevronDown, LogOut
} from 'lucide-react';
import { apiRequest, resolveWebSocketUrl } from '../../lib/api';
import { chatPreviewText, sortByRecentChatActivity, type ChatLatestMessageLike } from '../../lib/chat';
import { clearStoredSession, getPortalSegmentForRole, getPreferredPortalPath, getStoredSession } from '../../lib/session';
import { getTopNavNotificationAccess } from '../../lib/topNavNotifications';

interface NotificationAnnouncement {
  id: string;
  title: string;
  audience: string;
  urgent: boolean;
  createdAt: string;
}

interface NotificationChatChannel {
  id: string;
  name: string;
  kind: string;
  createdAt?: string;
  latestMessage?: ChatLatestMessageLike;
}

interface NotificationChatItem {
  id: string;
  name: string;
  kind: string;
  latestMessage?: NotificationChatChannel['latestMessage'];
}

interface NotificationRequest {
  id: string;
  title: string;
  status: string;
  type: string;
  createdAt: string;
}

interface NotificationListResponse<TItem> {
  items: TItem[];
  total: number;
}

const ANNOUNCEMENT_AUDIENCES = ['All Employees', 'IT Team', 'Super Admin'] as const;
const EMPLOYEE_ANNOUNCEMENT_AUDIENCES = ['All Employees'] as const;
const NOTIFICATION_PAGE_SIZE = 4;
const ANNOUNCEMENTS_UPDATED_EVENT = 'itms:announcements-updated';
const CHAT_UPDATED_EVENT = 'itms:chat-updated';
const REQUESTS_UPDATED_EVENT = 'itms:requests-updated';

function getNotificationAudiences(role: string) {
  if (role === 'super_admin' || role === 'it_team') {
    return ANNOUNCEMENT_AUDIENCES;
  }

  return EMPLOYEE_ANNOUNCEMENT_AUDIENCES;
}

function encodeProtocolToken(token: string) {
  return btoa(token).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function announcementSocketUrl() {
  return resolveWebSocketUrl('/ws/announcements');
}

function announcementSocketProtocols(token: string) {
  return ['itms.announcements.v1', `bearer.${encodeProtocolToken(token)}`];
}

function formatRequestStatus(status: string) {
  return status.replace(/_/g, ' ');
}

export default function TopNav() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [announcementNotifications, setAnnouncementNotifications] = useState<NotificationAnnouncement[]>([]);
  const [announcementTotal, setAnnouncementTotal] = useState(0);
  const [chatNotifications, setChatNotifications] = useState<NotificationChatItem[]>([]);
  const [chatTotal, setChatTotal] = useState(0);
  const [requestNotifications, setRequestNotifications] = useState<NotificationRequest[]>([]);
  const [requestTotal, setRequestTotal] = useState(0);
  const location = useLocation();
  const session = getStoredSession();
  const sessionToken = session?.token || '';
  const sessionRole = session?.user.role || '';
  const isAuditor = sessionRole === 'auditor';
  const notificationAccess = getTopNavNotificationAccess(sessionRole);
  const portalMatch = location.pathname.match(/^\/(admin|it|audit|emp)(?:\/|$)/);
  const currentPortal = portalMatch?.[1] || (session ? getPortalSegmentForRole(session.user.role) : 'emp');
  const basePath = portalMatch ? `/${portalMatch[1]}` : `/${currentPortal}`;
  const notificationAudiences = getNotificationAudiences(sessionRole);

  useEffect(() => {
    let cancelled = false;
    let announcementSocket: WebSocket | null = null;

    const loadNotifications = async () => {
      if (!sessionToken) {
        setAnnouncementNotifications([]);
        setAnnouncementTotal(0);
        setChatNotifications([]);
        setChatTotal(0);
        setRequestNotifications([]);
        setRequestTotal(0);
        return;
      }

      try {
        const announcementParams = new URLSearchParams({ paginate: '1', page: '1', page_size: String(NOTIFICATION_PAGE_SIZE) });
        const requestsPath = sessionRole === 'employee'
          ? `/api/me/requests?paginate=1&page=1&page_size=${NOTIFICATION_PAGE_SIZE}`
          : `/api/requests?paginate=1&page=1&page_size=${NOTIFICATION_PAGE_SIZE}`;

        notificationAudiences.forEach((audience) => announcementParams.append('audience', audience));
        const shouldLoadAnnouncements = notificationAccess.announcements;
        const shouldLoadChat = notificationAccess.chat;
        const shouldLoadRequests = notificationAccess.requests;

        const [announcementResult, chatChannelsResult, requestsResult] = await Promise.allSettled([
          shouldLoadAnnouncements
            ? apiRequest<NotificationListResponse<NotificationAnnouncement>>(`/api/announcements?${announcementParams.toString()}`)
            : Promise.resolve({ items: [], total: 0 }),
          shouldLoadChat
            ? apiRequest<NotificationListResponse<NotificationChatChannel>>(`/api/chat/channels?paginate=1&page=1&page_size=${NOTIFICATION_PAGE_SIZE}`)
            : Promise.resolve({ items: [], total: 0 }),
          shouldLoadRequests
            ? apiRequest<NotificationListResponse<NotificationRequest>>(requestsPath)
            : Promise.resolve({ items: [], total: 0 }),
        ]);
        if (!cancelled) {
          const announcementData = announcementResult.status === 'fulfilled' ? announcementResult.value : null;
          const requestsData = requestsResult.status === 'fulfilled' ? requestsResult.value : null;

          let chatItems: NotificationChatItem[] = [];
          let chatCount = 0;
          if (chatChannelsResult.status === 'fulfilled') {
            const chatData = chatChannelsResult.value;
            chatItems = sortByRecentChatActivity((chatData.items ?? [])
              .map((channel) => ({
                id: channel.id,
                name: channel.name,
                kind: channel.kind,
                createdAt: channel.createdAt,
                latestMessage: channel.latestMessage,
              })));
            chatCount = chatData.total || chatItems.length;
          }

          setAnnouncementNotifications(announcementData?.items ?? []);
          setAnnouncementTotal(announcementData?.total || 0);
          setChatNotifications(chatItems);
          setChatTotal(chatCount);
          setRequestNotifications(requestsData?.items ?? []);
          setRequestTotal(requestsData?.total || 0);
        }
      } catch {
        if (!cancelled) {
          setAnnouncementNotifications([]);
          setAnnouncementTotal(0);
          setChatNotifications([]);
          setChatTotal(0);
          setRequestNotifications([]);
          setRequestTotal(0);
        }
      }
    };

    void loadNotifications();

    if (sessionToken && notificationAccess.announcements) {
      announcementSocket = new WebSocket(announcementSocketUrl(), announcementSocketProtocols(sessionToken));
      announcementSocket.onmessage = () => {
        if (!cancelled) {
          void loadNotifications();
          window.dispatchEvent(new Event(ANNOUNCEMENTS_UPDATED_EVENT));
        }
      };
    }

    const handleAnnouncementUpdate = () => {
      void loadNotifications();
    };

    const handleChatUpdate = () => {
      void loadNotifications();
    };

    const handleRequestUpdate = () => {
      void loadNotifications();
    };

    window.addEventListener(ANNOUNCEMENTS_UPDATED_EVENT, handleAnnouncementUpdate);
    window.addEventListener(CHAT_UPDATED_EVENT, handleChatUpdate);
    window.addEventListener(REQUESTS_UPDATED_EVENT, handleRequestUpdate);

    return () => {
      cancelled = true;
      window.removeEventListener(ANNOUNCEMENTS_UPDATED_EVENT, handleAnnouncementUpdate);
      window.removeEventListener(CHAT_UPDATED_EVENT, handleChatUpdate);
      window.removeEventListener(REQUESTS_UPDATED_EVENT, handleRequestUpdate);
      announcementSocket?.close();
    };
  }, [location.pathname, notificationAccess.announcements, notificationAccess.chat, notificationAccess.requests, notificationAudiences, sessionRole, sessionToken]);

  const notificationSections = (() => {
    const sections = [
      {
        key: 'announcements',
        title: 'Announcements',
        total: announcementTotal,
        href: `${basePath}/announcements`,
        items: announcementNotifications,
      },
      {
        key: 'chat',
        title: 'Chat',
        total: chatTotal,
        href: `${basePath}/chat`,
        items: chatNotifications,
      },
      {
        key: 'requests',
        title: 'Requests',
        total: requestTotal,
        href: `${basePath}/requests`,
        items: requestNotifications,
      },
    ] as const;

    if (sessionRole === 'auditor') {
      return sections.filter((section) => section.key === 'announcements');
    }

    return sections;
  })();

  const totalNotificationCount = announcementTotal + chatTotal + requestTotal;

  return (
    <header className="bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-40 shadow-sm text-zinc-800 dark:text-zinc-100 transition-colors">
      <div className="flex h-14 items-center justify-between gap-3 px-4 xl:px-6">
        
        {/* Logo */}
        <Link to={`${basePath}/dashboard`} className="flex flex-shrink-0 items-center group cursor-pointer transition-opacity hover:opacity-90">
          <img 
            src="/itms-logo-light.svg"
            alt="ITMS - IT Management System - Zerodha" 
            className="h-9 w-auto object-contain"
          />
        </Link>

        {/* Right Actions */}
        <div className="ml-auto flex flex-shrink-0 items-center gap-3">
          {!isAuditor ? <div className="relative hidden lg:block">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
            </div>
            <input
              type="text"
              className="block w-40 rounded border border-zinc-200 bg-white py-1.5 pl-9 pr-3 text-zinc-900 placeholder-zinc-400 transition-colors focus:border-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-500 xl:w-44 sm:text-xs"
              placeholder="Search..."
            />
          </div> : null}
          
          {!isAuditor ? <div className="relative">
            <button
              type="button"
              onClick={() => setIsNotificationsOpen((current) => !current)}
              className="relative rounded-md border border-zinc-200 bg-white p-1.5 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white dark:focus:ring-zinc-700"
            >
              <Bell className="h-4 w-4" />
              {totalNotificationCount > 0 ? <span className="absolute top-1 right-1 block h-1.5 w-1.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-zinc-900" /> : null}
            </button>
            {isNotificationsOpen ? (
              <div className="absolute right-0 mt-2 w-[26rem] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg z-50 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-bold text-zinc-900 dark:text-white">
                      Notifications
                    </div>
                    <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      {totalNotificationCount} total
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    {notificationSections.map((section) => (
                      <Link
                        key={section.key}
                        to={section.href}
                        onClick={() => setIsNotificationsOpen(false)}
                        className="rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs font-bold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        <div>{section.title}</div>
                        <div className="mt-1 text-sm text-zinc-900 dark:text-white">{section.total}</div>
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="max-h-[28rem] overflow-y-auto">
                  {notificationSections.map((section) => (
                    <div key={section.key} className="border-b border-zinc-100 px-4 py-3 last:border-b-0 dark:border-zinc-800">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{section.title}</div>
                        <Link to={section.href} onClick={() => setIsNotificationsOpen(false)} className="text-xs font-bold text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white">
                          Open
                        </Link>
                      </div>
                      {section.items.length === 0 ? (
                        <div className="rounded-lg border border-zinc-200 bg-white px-3 py-3 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">No recent {section.title.toLowerCase()}.</div>
                      ) : null}
                      {section.key === 'announcements' ? (section.items as NotificationAnnouncement[]).map((item) => (
                        <Link key={item.id} to={section.href} onClick={() => setIsNotificationsOpen(false)} className="mb-2 block rounded-lg border border-zinc-200 bg-white px-3 py-3 transition last:mb-0 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800/70">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-zinc-900 dark:text-white">{item.title}</div>
                            <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                              {item.urgent ? 'Urgent' : item.audience}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{new Date(item.createdAt).toLocaleString()}</div>
                        </Link>
                      )) : null}
                      {section.key === 'chat' ? (section.items as NotificationChatItem[]).map((item) => (
                        <Link key={item.id} to={section.href} onClick={() => setIsNotificationsOpen(false)} className="mb-2 block rounded-lg border border-zinc-200 bg-white px-3 py-3 transition last:mb-0 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800/70">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-zinc-900 dark:text-white">{item.name}</div>
                            <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">{item.kind}</span>
                          </div>
                          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            {chatPreviewText(item.latestMessage, 'No recent messages')}
                          </div>
                          <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                            {item.latestMessage?.createdAt ? new Date(item.latestMessage.createdAt).toLocaleString() : 'Waiting for activity'}
                          </div>
                        </Link>
                      )) : null}
                      {section.key === 'requests' ? (section.items as NotificationRequest[]).map((item) => (
                        <Link key={item.id} to={section.href} onClick={() => setIsNotificationsOpen(false)} className="mb-2 block rounded-lg border border-zinc-200 bg-white px-3 py-3 transition last:mb-0 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800/70">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-zinc-900 dark:text-white">{item.title}</div>
                            <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">{formatRequestStatus(item.status)}</span>
                          </div>
                          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{item.type} • {new Date(item.createdAt).toLocaleString()}</div>
                        </Link>
                      )) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div> : null}
          
          {!isAuditor ? <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800 mx-1"></div> : null}

          <div className="relative">
             <button 
                onClick={() => {
                  setIsNotificationsOpen(false);
                  setIsMenuOpen(!isMenuOpen);
                }}
                className="group flex items-center gap-2 rounded-md border border-zinc-200 bg-white p-1 pl-1 transition-colors hover:bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/50 dark:hover:border-zinc-700 dark:focus:ring-zinc-700"
             >
                <div className="flex h-7 w-7 items-center justify-center rounded-sm border border-zinc-200 bg-white text-zinc-700 font-bold text-xs ring-1 ring-black/5 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-white/10">
                  {session?.shortName || 'SA'}
                </div>
                <ChevronDown className={`h-3 w-3 text-zinc-400 dark:text-zinc-500 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
             </button>
             
             {isMenuOpen && (
                 <div className="absolute right-0 mt-2 w-48 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg z-50 animate-in fade-in slide-in-from-top-2 dark:border-zinc-800 dark:bg-zinc-900">
                   {session && !isAuditor ? (
                     <Link
                       to={getPreferredPortalPath(session.user)}
                       onClick={() => setIsMenuOpen(false)}
                       className="block w-full px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
                     >
                       My Profile
                     </Link>
                   ) : null}
                   <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1"></div>
                   <button 
                      onClick={() => {
                       clearStoredSession();
                         window.location.href = '/login';
                      }}
                       className="flex w-full items-center px-4 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
                   >
                      <LogOut className="w-4 h-4 mr-2" />
                      Secure Logout
                   </button>
                </div>
             )}
          </div>
        </div>
      </div>
    </header>
  );
}
