import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, Megaphone, Plus } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { getStoredSession } from '../lib/session';
import Pagination from '../components/Pagination';
import { formatAnnouncementTimestamp, getVisibleAudiences } from './announcementsUtils';

const ANNOUNCEMENTS_PAGE_SIZE = 12;
const AUDIENCE_OPTIONS = ['All Employees', 'IT Team', 'Super Admin'] as const;
const ANNOUNCEMENT_FILTERS = ['All', ...AUDIENCE_OPTIONS] as const;
const ANNOUNCEMENTS_UPDATED_EVENT = 'itms:announcements-updated';

interface Announcement {
   id: string;
   title: string;
   body: string;
   audience: string;
   urgent: boolean;
   createdAt: string;
   authorName: string;
}

interface PaginatedAnnouncementsResponse {
   items: Announcement[];
   total: number;
   page: number;
   pageSize: number;
}

type AnnouncementFilter = typeof ANNOUNCEMENT_FILTERS[number];

export default function Announcements() {
   const session = getStoredSession();
   const role = session?.user.role || '';
   const canPost = role === 'super_admin' || role === 'it_team';
   const isAuditor = role === 'auditor';
   const [announcements, setAnnouncements] = useState<Announcement[]>([]);
   const [loading, setLoading] = useState(true);
   const [saving, setSaving] = useState(false);
   const [error, setError] = useState('');
   const [successMessage, setSuccessMessage] = useState('');
   const [currentPage, setCurrentPage] = useState(1);
   const [totalAnnouncements, setTotalAnnouncements] = useState(0);
   const [audienceFilter, setAudienceFilter] = useState<AnnouncementFilter>('All');
   const [form, setForm] = useState({ title: '', body: '', audience: 'All Employees', urgent: false });
   const previousAudienceFilterRef = useRef<AnnouncementFilter>('All');
   const visibleAudiences = useMemo(() => getVisibleAudiences(role, canPost), [canPost, role]);
   const featuredAnnouncements = useMemo(() => announcements.slice(0, 3), [announcements]);
   const olderAnnouncements = useMemo(() => announcements.slice(3), [announcements]);
   const urgentCount = useMemo(() => announcements.filter((item) => item.urgent).length, [announcements]);
   const activeAudienceLabel = audienceFilter === 'All' ? 'All visible audiences' : audienceFilter;

   const loadAnnouncements = useCallback(async () => {
      setLoading(true);
      setError('');
      try {
         const params = new URLSearchParams({
            paginate: '1',
            page: String(currentPage),
            page_size: String(ANNOUNCEMENTS_PAGE_SIZE),
         });
         if (audienceFilter === 'All') {
            visibleAudiences.forEach((audience) => params.append('audience', audience));
         } else {
            params.append('audience', audienceFilter);
         }
         const data = await apiRequest<PaginatedAnnouncementsResponse>(`/api/announcements?${params.toString()}`);
         setAnnouncements(Array.isArray(data.items) ? data.items : []);
         setTotalAnnouncements(data.total);
      } catch (requestError) {
         setError(requestError instanceof Error ? requestError.message : 'Failed to load announcements');
      } finally {
         setLoading(false);
      }
   }, [audienceFilter, currentPage, visibleAudiences]);

   useEffect(() => {
      const filterChanged = previousAudienceFilterRef.current !== audienceFilter;

      if (filterChanged && currentPage !== 1) {
         return;
      }

      previousAudienceFilterRef.current = audienceFilter;
      void loadAnnouncements();
   }, [audienceFilter, currentPage, loadAnnouncements]);

   useEffect(() => {
      const handleAnnouncementUpdate = () => {
         void loadAnnouncements();
      };
      window.addEventListener(ANNOUNCEMENTS_UPDATED_EVENT, handleAnnouncementUpdate);

      return () => {
         window.removeEventListener(ANNOUNCEMENTS_UPDATED_EVENT, handleAnnouncementUpdate);
      };
   }, [loadAnnouncements]);

   useEffect(() => {
      setCurrentPage((current) => (current === 1 ? current : 1));
   }, [audienceFilter]);

   useEffect(() => {
      if (isAuditor && audienceFilter !== 'All') {
         setAudienceFilter('All');
      }
   }, [audienceFilter, isAuditor]);

   const handleSubmit = async (event: React.FormEvent) => {
      event.preventDefault();
      if (!canPost || !form.title.trim() || !form.body.trim()) {
         return;
      }

      try {
         setSaving(true);
         setError('');
         setSuccessMessage('');
         const nextAudienceFilter = form.audience as AnnouncementFilter;
         await apiRequest('/api/announcements', {
            method: 'POST',
            body: JSON.stringify({
               title: form.title.trim(),
               body: form.body.trim(),
               audience: form.audience,
               urgent: form.urgent,
            }),
         });
         setForm({ title: '', body: '', audience: 'All Employees', urgent: false });
         setAudienceFilter(nextAudienceFilter);
         setSuccessMessage('Announcement posted successfully.');

         if (currentPage !== 1 || audienceFilter !== nextAudienceFilter) {
            setCurrentPage(1);
            return;
         }

         await loadAnnouncements();
      } catch (requestError) {
         setError(requestError instanceof Error ? requestError.message : 'Failed to create announcement');
      } finally {
         setSaving(false);
      }
   };

   return (
      <div style={{ fontFamily: 'Public Sans, sans-serif', backgroundColor: '#f5f6f8', minHeight: 'calc(100vh - 60px)', width: '100%' }}>
      <div style={{ width: '100%', margin: 0, padding: '28px 32px 48px' }} className="space-y-6">
         <section className="overflow-hidden rounded-xl" style={{ border: '1px solid #e6e8eb', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div className="grid gap-6 px-6 py-7 lg:grid-cols-[minmax(0,1.2fr)_360px] lg:px-8">
               <div>
                  <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em]" style={{ border: '1px solid #dbe4ff', background: '#eef2ff', color: '#2563eb' }}>
                     <Megaphone className="h-3.5 w-3.5" />
                     Broadcast Center
                  </div>
                  <h1 className="mt-4 text-3xl font-bold md:text-4xl" style={{ color: '#1a1d21', letterSpacing: '-0.5px' }}>Company announcements with a clearer broadcast view.</h1>
                  <p className="mt-3 max-w-3xl text-sm leading-6 md:text-base" style={{ color: '#6b7280' }}>
                     Publish updates for employees, IT, admin, and audit review with a cleaner featured feed, urgency tracking, and audience-specific filtering.
                  </p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                     <div className="rounded-xl p-4" style={{ border: '1px solid #f2f3f5', background: '#f5f6f8', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: '#9aa1ab' }}>Visible Now</div>
                        <div className="mt-2 text-3xl font-bold" style={{ color: '#1a1d21' }}>{totalAnnouncements}</div>
                        <div className="mt-1 text-sm" style={{ color: '#8b919b' }}>Announcements in the current feed.</div>
                     </div>
                     <div className="rounded-xl p-4" style={{ border: '1px solid #f2f3f5', background: '#f5f6f8', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: '#9aa1ab' }}>Urgent</div>
                        <div className="mt-2 text-3xl font-bold text-rose-600">{urgentCount}</div>
                        <div className="mt-1 text-sm" style={{ color: '#8b919b' }}>Posts marked for immediate attention.</div>
                     </div>
                     <div className="rounded-xl p-4" style={{ border: '1px solid #f2f3f5', background: '#f5f6f8', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: '#9aa1ab' }}>Audience</div>
                        <div className="mt-2 text-lg font-bold" style={{ color: '#1a1d21' }}>{activeAudienceLabel}</div>
                        <div className="mt-1 text-sm" style={{ color: '#8b919b' }}>Current broadcast segment.</div>
                     </div>
                  </div>
               </div>

               <div className="rounded-xl p-6 text-white" style={{ border: '1px solid #1e293b', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                  <div className="flex items-center justify-between gap-3">
                     <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: '#dbe4ff' }}>Live Feed</div>
                        <div className="mt-2 text-2xl font-bold">Broadcast pulse</div>
                     </div>
                     <BellRing className="h-8 w-8" style={{ color: '#93c5fd' }} />
                  </div>
                  <div className="mt-5 space-y-3">
                     {featuredAnnouncements.slice(0, 2).map((item) => (
                        <div key={`hero-${item.id}`} className="rounded-xl p-4" style={{ border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)' }}>
                           <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold">{item.title}</div>
                              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${item.urgent ? 'bg-rose-500/20 text-rose-100' : 'text-blue-100'}`} style={!item.urgent ? { background: 'rgba(147, 197, 253, 0.15)' } : undefined}>
                                 {item.urgent ? 'Urgent' : item.audience}
                              </span>
                           </div>
                           <div className="mt-2 line-clamp-3 text-sm leading-6" style={{ color: '#e2e8f0' }}>{item.body}</div>
                           <div className="mt-3 text-xs" style={{ color: '#94a3b8' }}>{formatAnnouncementTimestamp(item.createdAt)}</div>
                        </div>
                     ))}
                     {featuredAnnouncements.length === 0 ? <div className="rounded-xl p-4 text-sm" style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#cbd5e1' }}>No announcements available for this filter.</div> : null}
                  </div>
               </div>
            </div>
         </section>

         {isAuditor ? <div className="rounded-xl p-4 text-sm" style={{ border: '1px solid #dbeafe', background: '#eff6ff', color: '#1e40af' }}>Auditor access is read-only. You can review employee, IT, and super admin broadcasts here, but posting stays restricted to IT operations and super admin users.</div> : null}
         {error ? <div className="rounded-xl p-4 text-sm" style={{ border: '1px solid #fecaca', background: '#fee', color: '#b91c1c' }}>{error}</div> : null}
         {successMessage ? <div className="rounded-xl p-4 text-sm" style={{ border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d' }}>{successMessage}</div> : null}

         <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-6">
               {canPost ? (
                  <form onSubmit={handleSubmit} className="grid gap-4 rounded-xl p-6 md:p-7" style={{ border: '1px solid #e6e8eb', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                     <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                           <div className="flex items-center gap-2 text-sm font-bold" style={{ color: '#1a1d21' }}>
                              <Plus className="h-4 w-4" style={{ color: '#2563eb' }} />
                              New announcement
                           </div>
                           <p className="mt-1 text-sm" style={{ color: '#8b919b' }}>Create a broadcast with title, target audience, and urgency flag.</p>
                        </div>
                        <div className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em]" style={{ border: '1px solid #eef0f2', background: '#f5f6f8', color: '#6b7280' }}>
                           Publish panel
                        </div>
                     </div>
                     <div className="grid gap-4 md:grid-cols-2">
                        <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Announcement title" className="w-full rounded-xl px-4 py-3 text-sm outline-none transition" style={{ border: '1px solid #e6e8eb', color: '#1a1d21', background: '#ffffff' }} />
                        <select value={form.audience} onChange={(event) => setForm((current) => ({ ...current, audience: event.target.value }))} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition" style={{ border: '1px solid #e6e8eb', color: '#1a1d21', background: '#ffffff' }}>
                           {AUDIENCE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                     </div>
                     <textarea value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} rows={5} placeholder="Write the announcement body" className="w-full rounded-xl px-4 py-3 text-sm outline-none transition" style={{ border: '1px solid #e6e8eb', color: '#1a1d21', background: '#ffffff' }} />
                     <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <label className="flex items-center gap-2 text-sm" style={{ color: '#3a3f47' }}>
                           <input type="checkbox" checked={form.urgent} onChange={(event) => setForm((current) => ({ ...current, urgent: event.target.checked }))} />
                           Mark as urgent
                        </label>
                        <button type="submit" disabled={saving} className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition disabled:opacity-60" style={{ border: '1px solid #2563eb', background: '#eef2ff', color: '#2563eb', boxShadow: '0 1px 2px rgba(37,99,235,0.15)' }}>
                           <Plus className="mr-2 h-4 w-4" />
                           {saving ? 'Posting...' : 'Post Announcement'}
                        </button>
                     </div>
                  </form>
               ) : null}

               {!isAuditor ? (
                  <div className="rounded-xl p-4" style={{ border: '1px solid #e6e8eb', background: '#ffffff', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                     <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: '#9aa1ab' }}>Audience Filters</div>
                     <div className="flex flex-wrap items-center gap-2">
                        {ANNOUNCEMENT_FILTERS.filter((option) => option === 'All' || visibleAudiences.includes(option)).map((option) => {
                           const active = audienceFilter === option;
                           return (
                              <button
                                 key={option}
                                 type="button"
                                 onClick={() => setAudienceFilter(option)}
                                 className={`rounded-full px-3 py-1.5 text-xs font-bold transition`}
                                 style={active ? { border: '1px solid #dbe4ff', background: '#eef2ff', color: '#2563eb' } : { border: '1px solid #eef0f2', background: '#f5f6f8', color: '#6b7280' }}
                              >
                                 {option}
                              </button>
                           );
                        })}
                     </div>
                  </div>
               ) : (
                  <div className="rounded-xl p-4 text-sm" style={{ border: '1px solid #e6e8eb', background: '#ffffff', color: '#6b7280', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                     Audit review shows the employee broadcast feed in read-only mode. Posting and audience management remain hidden outside the auditor portal.
                  </div>
               )}

               <div className="space-y-4">
                  {loading ? <div className="rounded-xl p-6 text-sm" style={{ border: '1px solid #e6e8eb', background: '#ffffff', color: '#8b919b', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>Loading announcements...</div> : null}
                  {!loading && announcements.length === 0 ? <div className="rounded-xl p-6 text-sm" style={{ border: '1px solid #e6e8eb', background: '#ffffff', color: '#8b919b', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>No announcements available for this filter.</div> : null}

                  {featuredAnnouncements.slice(0, 1).map((item) => (
                     <article key={item.id} className={`relative overflow-hidden rounded-xl p-6 md:p-7`} style={{ border: item.urgent ? '1px solid #fecaca' : '1px solid #e6e8eb', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div className={`absolute inset-x-0 top-0 h-1`} style={{ background: item.urgent ? '#ef4444' : '#2563eb' }} />
                        <div className="flex flex-wrap items-start justify-between gap-4">
                           <div>
                              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ border: '1px solid #eef0f2', background: '#f5f6f8', color: '#6b7280' }}>
                                 {item.urgent ? 'Urgent Broadcast' : item.audience}
                              </div>
                              <h2 className="mt-4 text-2xl font-bold" style={{ color: '#1a1d21', letterSpacing: '-0.5px' }}>{item.title}</h2>
                           </div>
                           <div className="rounded-xl px-4 py-3 text-right text-xs" style={{ background: '#f5f6f8', color: '#8b919b' }}>
                              <div className="font-bold uppercase tracking-[0.18em]" style={{ color: '#6b7280' }}>Published</div>
                              <div className="mt-1">{formatAnnouncementTimestamp(item.createdAt)}</div>
                           </div>
                        </div>
                        <p className="mt-5 whitespace-pre-wrap text-sm leading-7 md:text-[15px]" style={{ color: '#3a3f47' }}>{item.body}</p>
                        <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold" style={{ color: '#8b919b' }}>
                           <span>Author: {item.authorName}</span>
                           <span>Target: {item.audience || 'All Employees'}</span>
                        </div>
                     </article>
                  ))}

                  <div className="grid gap-4 lg:grid-cols-2">
                     {featuredAnnouncements.slice(1).map((item) => (
                        <article key={item.id} className={`rounded-xl p-5`} style={{ border: item.urgent ? '1px solid #fecaca' : '1px solid #e6e8eb', background: '#ffffff', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                           <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-bold uppercase tracking-[0.18em]" style={{ color: '#9aa1ab' }}>{item.audience}</div>
                              <div className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]`} style={item.urgent ? { background: '#fee2e2', color: '#b91c1c' } : { background: '#eff6ff', color: '#1e40af' }}>
                                 {item.urgent ? 'Urgent' : 'Broadcast'}
                              </div>
                           </div>
                           <h3 className="mt-3 text-lg font-bold" style={{ color: '#1a1d21' }}>{item.title}</h3>
                           <p className="mt-3 whitespace-pre-wrap text-sm leading-6" style={{ color: '#6b7280' }}>{item.body}</p>
                           <div className="mt-5 flex flex-wrap gap-3 text-xs font-semibold" style={{ color: '#8b919b' }}>
                              <span>{item.authorName}</span>
                              <span>{formatAnnouncementTimestamp(item.createdAt)}</span>
                           </div>
                        </article>
                     ))}
                  </div>
               </div>
            </div>

            <aside className="space-y-4">
               <div className="rounded-xl p-5" style={{ border: '1px solid #e6e8eb', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: '#9aa1ab' }}>Announcement History</div>
                  <div className="mt-2 text-2xl font-bold" style={{ color: '#1a1d21' }}>Older announcements</div>
                  <p className="mt-2 text-sm leading-6" style={{ color: '#8b919b' }}>Previous broadcasts stay visible as a compact review timeline for admins, IT, and audit users.</p>
               </div>

               <div className="space-y-3">
                  {loading ? <div className="rounded-xl p-5 text-sm" style={{ border: '1px solid #e6e8eb', background: '#ffffff', color: '#8b919b', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>Loading announcements...</div> : null}
                  {!loading && olderAnnouncements.length === 0 ? <div className="rounded-xl p-5 text-sm" style={{ border: '1px solid #e6e8eb', background: '#ffffff', color: '#8b919b', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>No older announcements for this filter.</div> : null}
                  {olderAnnouncements.map((item) => (
                     <article key={item.id} className="rounded-xl p-5" style={{ border: '1px solid #e6e8eb', background: '#ffffff', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                        <div className="flex items-start justify-between gap-3">
                           <div className="min-w-0">
                              <h3 className="text-base font-bold" style={{ color: '#1a1d21' }}>{item.title}</h3>
                              <div className="mt-2 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: '#9aa1ab' }}>{item.audience}</div>
                           </div>
                           <div className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]`} style={item.urgent ? { background: '#fee2e2', color: '#b91c1c' } : { background: '#f5f6f8', color: '#6b7280' }}>
                              {item.urgent ? 'Urgent' : 'Standard'}
                           </div>
                        </div>
                        <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-6" style={{ color: '#6b7280' }}>{item.body}</p>
                        <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold" style={{ color: '#8b919b' }}>
                           <span>{item.authorName}</span>
                           <span>{formatAnnouncementTimestamp(item.createdAt)}</span>
                        </div>
                     </article>
                  ))}
               </div>
            </aside>
         </div>

         <div className="rounded-xl" style={{ border: '1px solid #e6e8eb', background: '#ffffff', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <Pagination
               currentPage={currentPage}
               totalItems={totalAnnouncements}
               pageSize={ANNOUNCEMENTS_PAGE_SIZE}
               onPageChange={setCurrentPage}
               itemLabel="announcements"
            />
         </div>
      </div>
      </div>
   );
}
