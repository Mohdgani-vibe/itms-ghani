import { useEffect, useState } from 'react';
import { BookOpen, Edit, Eye, FileText, FolderOpen, Plus, Search, Trash2, Tag } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { getStoredSession } from '../../lib/session';
import ConfirmDialog from '../../components/ConfirmDialog';

interface DocsCategory {
  id: string;
  name: string;
  description?: string | null;
  pageCount: number;
}

interface DocsPage {
  id: string;
  title: string;
  content: string;
  categoryId: string;
  categoryName: string;
  tags: string[];
  published: boolean;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  viewCount: number;
  helpfulCount: number;
}

interface DocsPageCreate {
  title: string;
  content: string;
  categoryId: string;
  tags: string;
  published: boolean;
}

export default function DocsPage() {
  const session = getStoredSession();
  const role = session?.user.role?.toLowerCase() || '';
  const canWrite = role === 'super_admin' || role === 'it_team';
  const isAuditor = role === 'auditor';

  const [view, setView] = useState<'categories' | 'pages' | 'create' | 'edit'>('categories');
  const [categories, setCategories] = useState<DocsCategory[]>([]);
  const [pages, setPages] = useState<DocsPage[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedPage, setSelectedPage] = useState<DocsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'category' | 'page'; id: string; name: string } | null>(null);
  
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  
  const [pageForm, setPageForm] = useState<DocsPageCreate>({
    title: '',
    content: '',
    categoryId: '',
    tags: '',
    published: true,
  });

  useEffect(() => {
    void loadCategories();
  }, []);

  useEffect(() => {
    if (view === 'pages') {
      void loadPages();
    }
  }, [view, searchQuery, selectedCategory]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiRequest<DocsCategory[]>('/api/docs/categories');
      setCategories(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const loadPages = async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (selectedCategory) params.set('category', selectedCategory);
      const data = await apiRequest<DocsPage[]>(`/api/docs/pages?${params.toString()}`);
      setPages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pages');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setSuccess('');
      await apiRequest('/api/docs/categories', {
        method: 'POST',
        body: JSON.stringify(categoryForm),
      });
      setSuccess('Category created successfully');
      setCategoryForm({ name: '', description: '' });
      setShowCategoryForm(false);
      void loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create category');
    }
  };

  const handleCreatePage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setSuccess('');
      const payload = {
        ...pageForm,
        tags: pageForm.tags.split(',').map((t) => t.trim()).filter(Boolean),
      };
      await apiRequest('/api/docs/pages', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSuccess('Documentation page created successfully');
      setPageForm({
        title: '',
        content: '',
        categoryId: '',
        tags: '',
        published: true,
      });
      setView('pages');
      void loadPages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create page');
    }
  };

  const handleUpdatePage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPage) return;
    try {
      setError('');
      setSuccess('');
      const payload = {
        ...pageForm,
        tags: pageForm.tags.split(',').map((t) => t.trim()).filter(Boolean),
      };
      await apiRequest(`/api/docs/pages/${selectedPage.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setSuccess('Documentation page updated successfully');
      setView('pages');
      setSelectedPage(null);
      void loadPages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update page');
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteTarget || deleteTarget.type !== 'category') return;
    try {
      setError('');
      setSuccess('');
      await apiRequest(`/api/docs/categories/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      setSuccess('Category deleted successfully');
      setDeleteTarget(null);
      void loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category');
    }
  };

  const handleDeletePage = async () => {
    if (!deleteTarget || deleteTarget.type !== 'page') return;
    try {
      setError('');
      setSuccess('');
      await apiRequest(`/api/docs/pages/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      setSuccess('Page deleted successfully');
      setDeleteTarget(null);
      void loadPages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete page');
    }
  };

  const handleEditPage = (page: DocsPage) => {
    setSelectedPage(page);
    setPageForm({
      title: page.title,
      content: page.content,
      categoryId: page.categoryId,
      tags: page.tags.join(', '),
      published: page.published,
    });
    setView('edit');
  };

  const handleViewPage = async (pageId: string) => {
    try {
      const page = await apiRequest<DocsPage>(`/api/docs/pages/${pageId}`);
      setSelectedPage(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load page');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center">
            <BookOpen className="mr-3 h-6 w-6 text-brand-600" />
            IT Documentation
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Centralized knowledge base for IT procedures, troubleshooting guides, and technical documentation.
          </p>
        </div>
        <div className="flex gap-2">
          {canWrite && view === 'categories' && (
            <button
              type="button"
              onClick={() => setShowCategoryForm(true)}
              className="inline-flex items-center px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 font-medium"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Category
            </button>
          )}
          {canWrite && view === 'pages' && (
            <button
              type="button"
              onClick={() => setView('create')}
              className="inline-flex items-center px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700 font-medium"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Page
            </button>
          )}
          {(view === 'pages' || view === 'create' || view === 'edit') && (
            <button
              type="button"
              onClick={() => {
                setView('categories');
                setSelectedCategory('');
                setSelectedPage(null);
              }}
              className="inline-flex items-center px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50"
            >
              Back to Categories
            </button>
          )}
        </div>
      </div>

      {isAuditor && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          Auditor access: Read-only. You can view documentation but cannot create or edit content.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Categories View */}
      {view === 'categories' && (
        <>
          {showCategoryForm && (
            <div className="bg-white shadow-sm rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Create New Category</h2>
              <form onSubmit={handleCreateCategory} className="space-y-4">
                <div>
                  <label htmlFor="cat-name" className="block text-sm font-medium text-slate-700 mb-1">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    id="cat-name"
                    required
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="Network Troubleshooting"
                  />
                </div>
                <div>
                  <label htmlFor="cat-desc" className="block text-sm font-medium text-slate-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    id="cat-desc"
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="Network diagnostic procedures and common fixes"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700 font-medium"
                  >
                    Create Category
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCategoryForm(false);
                      setCategoryForm({ name: '', description: '' });
                    }}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-full py-12 text-center text-slate-500">Loading categories...</div>
            ) : categories.length === 0 ? (
              <div className="col-span-full py-12 text-center">
                <FolderOpen className="mx-auto h-12 w-12 text-slate-400" />
                <h3 className="mt-2 text-sm font-medium text-slate-900">No categories yet</h3>
                <p className="mt-1 text-sm text-slate-500">Create your first documentation category to get started.</p>
              </div>
            ) : (
              categories.map((category) => (
                <div
                  key={category.id}
                  className="bg-white rounded-lg border border-slate-200 p-5 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    setSelectedCategory(category.id);
                    setView('pages');
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-brand-100 p-2">
                        <FolderOpen className="h-5 w-5 text-brand-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{category.name}</h3>
                        <p className="text-xs text-slate-500 mt-1">{category.pageCount} page{category.pageCount !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    {canWrite && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({ type: 'category', id: category.id, name: category.name });
                        }}
                        className="p-1 text-rose-600 hover:text-rose-900 rounded-md hover:bg-rose-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {category.description && (
                    <p className="mt-3 text-sm text-slate-600">{category.description}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Pages View */}
      {view === 'pages' && (
        <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <div className="relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="focus:ring-brand-500 focus:border-brand-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-md py-2 px-3 border"
                placeholder="Search documentation..."
              />
            </div>
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center text-slate-500">Loading pages...</div>
          ) : pages.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-slate-400" />
              <h3 className="mt-2 text-sm font-medium text-slate-900">No pages found</h3>
              <p className="mt-1 text-sm text-slate-500">
                {searchQuery ? 'Try a different search term.' : 'Create your first documentation page.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {pages.map((page) => (
                <div key={page.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                        {page.title}
                        {!page.published && (
                          <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">Draft</span>
                        )}
                      </h3>
                      <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <FolderOpen className="h-3 w-3" />
                          {page.categoryName}
                        </span>
                        <span>{new Date(page.updatedAt).toLocaleDateString()}</span>
                        <span>By {page.authorName}</span>
                        <span>{page.viewCount} view{page.viewCount !== 1 ? 's' : ''}</span>
                      </div>
                      {page.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {page.tags.map((tag) => (
                            <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs">
                              <Tag className="h-3 w-3" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        type="button"
                        onClick={() => handleViewPage(page.id)}
                        className="p-2 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100"
                        title="View page"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {canWrite && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleEditPage(page)}
                            className="p-2 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100"
                            title="Edit page"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ type: 'page', id: page.id, name: page.title })}
                            className="p-2 text-rose-600 hover:text-rose-900 rounded-md hover:bg-rose-50"
                            title="Delete page"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Page Form */}
      {(view === 'create' || view === 'edit') && (
        <div className="bg-white shadow-sm rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            {view === 'create' ? 'Create New Page' : 'Edit Page'}
          </h2>
          <form onSubmit={view === 'create' ? handleCreatePage : handleUpdatePage} className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-slate-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                id="title"
                required
                value={pageForm.title}
                onChange={(e) => setPageForm({ ...pageForm, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="How to Reset User Password"
              />
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium text-slate-700 mb-1">
                Category *
              </label>
              <select
                id="category"
                required
                value={pageForm.categoryId}
                onChange={(e) => setPageForm({ ...pageForm, categoryId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="content" className="block text-sm font-medium text-slate-700 mb-1">
                Content * (Markdown supported)
              </label>
              <textarea
                id="content"
                required
                rows={12}
                value={pageForm.content}
                onChange={(e) => setPageForm({ ...pageForm, content: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-sm"
                placeholder="# Step 1: Navigate to Users&#10;&#10;Click on Users in the sidebar..."
              />
            </div>

            <div>
              <label htmlFor="tags" className="block text-sm font-medium text-slate-700 mb-1">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                id="tags"
                value={pageForm.tags}
                onChange={(e) => setPageForm({ ...pageForm, tags: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="password, active-directory, troubleshooting"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="published"
                checked={pageForm.published}
                onChange={(e) => setPageForm({ ...pageForm, published: e.target.checked })}
                className="h-4 w-4 text-brand-600 focus:ring-brand-500 border-slate-300 rounded"
              />
              <label htmlFor="published" className="ml-2 text-sm text-slate-700">
                Publish immediately (uncheck to save as draft)
              </label>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700 font-medium"
              >
                {view === 'create' ? 'Create Page' : 'Update Page'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setView('pages');
                  setSelectedPage(null);
                  setPageForm({
                    title: '',
                    content: '',
                    categoryId: '',
                    tags: '',
                    published: true,
                  });
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Page View Modal (simplified) */}
      {selectedPage && view === 'pages' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={() => setSelectedPage(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">{selectedPage.title}</h2>
              <button
                type="button"
                onClick={() => setSelectedPage(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </div>
            <div className="px-6 py-4">
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap font-sans">{selectedPage.content}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          open={true}
          title={`Delete ${deleteTarget.type === 'category' ? 'Category' : 'Page'}?`}
          message={`Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.${
            deleteTarget.type === 'category' ? ' All pages in this category will also be deleted.' : ''
          }`}
          confirmLabel={`Delete ${deleteTarget.type === 'category' ? 'Category' : 'Page'}`}
          tone="danger"
          onConfirm={deleteTarget.type === 'category' ? handleDeleteCategory : handleDeletePage}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
