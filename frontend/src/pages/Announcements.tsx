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
      <>
      <style>{`
         .announcements-page-root * { color: inherit !important; }
         .announcements-page-root .text-ink { color: #0F1B2D !important; }
         .announcements-page-root .text-muted { color: #8C96A4 !important; }
         .announcements-page-root .text-primary { color: #2667E8 !important; }
         .announcements-page-root .text-white { color: white !important; }
         .announcements-page-root .text-success { color: #30A46C !important; }
         .announcements-page-root .text-warning { color: #FFB224 !important; }
         .announcements-page-root .text-danger { color: #E5484D !important; }
         .announcements-page-root .bg-white { background-color: white !important; }
      `}</style>
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6 announcements-page-root">
         <section className="overflow-hidden rounded-[32px] border border-sky-100 bg-[radial-gradient(circle_at_top_left,_rgba(224,242,254,0.95),_rgba(255,255,255,0.98)_45%,_rgba(240,249,255,1)_100%)] shadow-sm">
            <div className="grid gap-6 px-6 py-7 lg:grid-cols-[minmax(0,1.2fr)_360px] lg:px-8">
               <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-sky-700">
                     <Megaphone className="h-3.5 w-3.5" />
                     Broadcast Center
                  </div>
                  <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-950 md:text-4xl">Company announcements with a clearer broadcast view.</h1>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600 md:text-base">
                     Publish updates for employees, IT, admin, and audit review with a cleaner featured feed, urgency tracking, and audience-specific filtering.
                  </p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                     <div className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm backdrop-blur">
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Visible Now</div>
                        <div className="mt-2 text-3xl font-bold text-zinc-950">{totalAnnouncements}</div>
                        <div className="mt-1 text-sm text-zinc-500">Announcements in the current feed.</div>
                     </div>
                     <div className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm backdrop-blur">
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Urgent</div>
                        <div className="mt-2 text-3xl font-bold text-rose-600">{urgentCount}</div>
                        <div className="mt-1 text-sm text-zinc-500">Posts marked for immediate attention.</div>
                     </div>
                     <div className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm backdrop-blur">
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Audience</div>
                        <div className="mt-2 text-lg font-bold text-zinc-950">{activeAudienceLabel}</div>
                        <div className="mt-1 text-sm text-zinc-500">Current broadcast segment.</div>
                     </div>
                  </div>
               </div>

               <div className="rounded-[28px] border border-zinc-200 bg-zinc-950 p-6 text-white shadow-xl shadow-sky-100/50">
                  <div className="flex items-center justify-between gap-3">
                     <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-200">Live Feed</div>
                        <div className="mt-2 text-2xl font-bold">Broadcast pulse</div>
                     </div>
                     <BellRing className="h-8 w-8 text-sky-300" />
                  </div>
                  <div className="mt-5 space-y-3">
                     {featuredAnnouncements.slice(0, 2).map((item) => (
                        <div key={`hero-${item.id}`} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                           <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold">{item.title}</div>
                              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${item.urgent ? 'bg-rose-500/20 text-rose-100' : 'bg-sky-400/15 text-sky-100'}`}>
                                 {item.urgent ? 'Urgent' : item.audience}
                              </span>
                           </div>
                           <div className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-200">{item.body}</div>
                           <div className="mt-3 text-xs text-zinc-400">{formatAnnouncementTimestamp(item.createdAt)}</div>
                        </div>
                     ))}
                     {featuredAnnouncements.length === 0 ? <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">No announcements available for this filter.</div> : null}
                  </div>
               </div>
            </div>
         </section>

         {isAuditor ? <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">Auditor access is read-only. You can review employee, IT, and super admin broadcasts here, but posting stays restricted to IT operations and super admin users.</div> : null}
         {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}
         {successMessage ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{successMessage}</div> : null}

         <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-6">
               {canPost ? (
                  <form onSubmit={handleSubmit} className="grid gap-4 rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm md:p-7">
                     <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                           <div className="flex items-center gap-2 text-sm font-bold text-zinc-900">
                              <Plus className="h-4 w-4 text-brand-600" />
                              New announcement
                           </div>
                           <p className="mt-1 text-sm text-zinc-500">Create a broadcast with title, target audience, and urgency flag.</p>
                        </div>
                        <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-zinc-600">
                           Publish panel
                        </div>
                     </div>
                     <div className="grid gap-4 md:grid-cols-2">
                        <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Announcement title" className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100" />
                        <select value={form.audience} onChange={(event) => setForm((current) => ({ ...current, audience: event.target.value }))} className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100">
                           {AUDIENCE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                     </div>
                     <textarea value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} rows={5} placeholder="Write the announcement body" className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100" />
                     <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <label className="flex items-center gap-2 text-sm text-zinc-700">
                           <input type="checkbox" checked={form.urgent} onChange={(event) => setForm((current) => ({ ...current, urgent: event.target.checked }))} />
                           Mark as urgent
                        </label>
                        <button type="submit" disabled={saving} className="inline-flex items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 px-5 py-3 text-sm font-semibold text-sky-800 shadow-sm transition hover:bg-sky-100 disabled:opacity-60">
                           <Plus className="mr-2 h-4 w-4" />
                           {saving ? 'Posting...' : 'Post Announcement'}
                        </button>
                     </div>
                  </form>
               ) : null}

               {!isAuditor ? (
                  <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm">
                     <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Audience Filters</div>
                     <div className="flex flex-wrap items-center gap-2">
                        {ANNOUNCEMENT_FILTERS.filter((option) => option === 'All' || visibleAudiences.includes(option)).map((option) => {
                           const active = audienceFilter === option;
                           return (
                              <button
                                 key={option}
                                 type="button"
                                 onClick={() => setAudienceFilter(option)}
                                 className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${active ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700'}`}
                              >
                                 {option}
                              </button>
                           );
                        })}
                     </div>
                  </div>
               ) : (
                  <div className="rounded-[24px] border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
                     Audit review shows the employee broadcast feed in read-only mode. Posting and audience management remain hidden outside the auditor portal.
                  </div>
               )}

               <div className="space-y-4">
                  {loading ? <div className="rounded-[24px] border border-zinc-200 bg-white p-6 text-sm text-zinc-500 shadow-sm">Loading announcements...</div> : null}
                  {!loading && announcements.length === 0 ? <div className="rounded-[24px] border border-zinc-200 bg-white p-6 text-sm text-zinc-500 shadow-sm">No announcements available for this filter.</div> : null}

                  {featuredAnnouncements.slice(0, 1).map((item) => (
                     <article key={item.id} className={`relative overflow-hidden rounded-[28px] border bg-white p-6 shadow-sm md:p-7 ${item.urgent ? 'border-rose-200' : 'border-zinc-200'}`}>
                        <div className={`absolute inset-x-0 top-0 h-1 ${item.urgent ? 'bg-rose-500' : 'bg-sky-500'}`} />
                        <div className="flex flex-wrap items-start justify-between gap-4">
                           <div>
                              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-600">
                                 {item.urgent ? 'Urgent Broadcast' : item.audience}
                              </div>
                              <h2 className="mt-4 text-2xl font-bold tracking-tight text-zinc-950">{item.title}</h2>
                           </div>
                           <div className="rounded-2xl bg-zinc-50 px-4 py-3 text-right text-xs text-zinc-500">
                              <div className="font-bold uppercase tracking-[0.18em] text-zinc-600">Published</div>
                              <div className="mt-1">{formatAnnouncementTimestamp(item.createdAt)}</div>
                           </div>
                        </div>
                        <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-zinc-700 md:text-[15px]">{item.body}</p>
                        <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold text-zinc-500">
                           <span>Author: {item.authorName}</span>
                           <span>Target: {item.audience || 'All Employees'}</span>
                        </div>
                     </article>
                  ))}

                  <div className="grid gap-4 lg:grid-cols-2">
                     {featuredAnnouncements.slice(1).map((item) => (
                        <article key={item.id} className={`rounded-[24px] border bg-white p-5 shadow-sm ${item.urgent ? 'border-rose-200' : 'border-zinc-200'}`}>
                           <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-bold uppercase tracking-[0.18em] text-zinc-500">{item.audience}</div>
                              <div className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${item.urgent ? 'bg-rose-100 text-rose-700' : 'bg-sky-100 text-sky-700'}`}>
                                 {item.urgent ? 'Urgent' : 'Broadcast'}
                              </div>
                           </div>
                           <h3 className="mt-3 text-lg font-bold text-zinc-950">{item.title}</h3>
                           <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-600">{item.body}</p>
                           <div className="mt-5 flex flex-wrap gap-3 text-xs font-semibold text-zinc-500">
                              <span>{item.authorName}</span>
                              <span>{formatAnnouncementTimestamp(item.createdAt)}</span>
                           </div>
                        </article>
                     ))}
                  </div>
               </div>
            </div>

            <aside className="space-y-4">
               <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Announcement History</div>
                  <div className="mt-2 text-2xl font-bold text-zinc-950">Older announcements</div>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">Previous broadcasts stay visible as a compact review timeline for admins, IT, and audit users.</p>
               </div>

               <div className="space-y-3">
                  {loading ? <div className="rounded-[24px] border border-zinc-200 bg-white p-5 text-sm text-zinc-500 shadow-sm">Loading announcements...</div> : null}
                  {!loading && olderAnnouncements.length === 0 ? <div className="rounded-[24px] border border-zinc-200 bg-white p-5 text-sm text-zinc-500 shadow-sm">No older announcements for this filter.</div> : null}
                  {olderAnnouncements.map((item) => (
                     <article key={item.id} className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                           <div className="min-w-0">
                              <h3 className="text-base font-bold text-zinc-950">{item.title}</h3>
                              <div className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{item.audience}</div>
                           </div>
                           <div className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${item.urgent ? 'bg-rose-100 text-rose-700' : 'bg-zinc-100 text-zinc-600'}`}>
                              {item.urgent ? 'Urgent' : 'Standard'}
                           </div>
                        </div>
                        <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-zinc-600">{item.body}</p>
                        <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-zinc-500">
                           <span>{item.authorName}</span>
                           <span>{formatAnnouncementTimestamp(item.createdAt)}</span>
                        </div>
                     </article>
                  ))}
               </div>
            </aside>
         </div>

         <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
            <Pagination
               currentPage={currentPage}
               totalItems={totalAnnouncements}
               pageSize={ANNOUNCEMENTS_PAGE_SIZE}
               onPageChange={setCurrentPage}
               itemLabel="announcements"
            />
         </div>
      </div>
      </>
   );
}
