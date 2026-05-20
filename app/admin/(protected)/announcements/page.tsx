/* eslint-disable @next/next/no-img-element */
"use client";

import {
  Edit3,
  Eye,
  ImageIcon,
  Megaphone,
  Plus,
  Search,
  Trash2,
  X
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createAnnouncement,
  deleteAnnouncement,
  fetchAnnouncements,
  fetchAuthorNamesByIds,
  updateAnnouncement,
  uploadAnnouncementImage
} from "@/lib/announcements";
import { ImageViewer } from "@/components/image-viewer";
import type { Announcement } from "@/lib/types";

type AnnouncementForm = {
  id?: string;
  title: string;
  content: string;
  thumbnailUrl: string;
  imageUrlsText: string;
  isPublished: boolean;
};

const emptyForm: AnnouncementForm = {
  title: "",
  content: "",
  thumbnailUrl: "",
  imageUrlsText: "",
  isPublished: true
};

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [authorNames, setAuthorNames] = useState<Map<string, string>>(new Map());
  const [activeView, setActiveView] = useState<"create" | "posted">("create");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [viewingImage, setViewingImage] = useState<{ title: string; url: string } | null>(null);
  const [form, setForm] = useState<AnnouncementForm>(emptyForm);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  async function loadAnnouncements() {
    setIsLoading(true);
    try {
      const data = await fetchAnnouncements();
      setAnnouncements(data);
      try {
        const names = await fetchAuthorNamesByIds(
          data.map((announcement) => announcement.created_by ?? "")
        );
        setAuthorNames(names);
      } catch {
        setAuthorNames(new Map());
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load announcements.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAnnouncements();
  }, []);

  const publishedCount = announcements.filter((item) => item.is_published).length;
  const draftCount = announcements.length - publishedCount;

  const visibleAnnouncements = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return announcements
      .filter((announcement) => {
        if (statusFilter === "published") return announcement.is_published;
        if (statusFilter === "draft") return !announcement.is_published;
        return true;
      })
      .filter((announcement) => {
        if (!query) return true;
        return (
          announcement.title.toLowerCase().includes(query) ||
          plainText(announcement.content).toLowerCase().includes(query)
        );
      });
  }, [announcements, searchQuery, statusFilter]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.title.trim() || !form.content.trim()) {
      setMessage("Title and content are required.");
      return;
    }

    setIsSubmitting(true);

    try {
      const imageUrls = parseImageUrls(form.imageUrlsText, form.thumbnailUrl);

      if (form.id) {
        await updateAnnouncement({
          id: form.id,
          title: form.title,
          content: form.content,
          thumbnailUrl: form.thumbnailUrl,
          imageUrls,
          isPublished: form.isPublished
        });
        setMessage("Announcement updated.");
      } else {
        await createAnnouncement({
          title: form.title,
          content: form.content,
          thumbnailUrl: form.thumbnailUrl,
          imageUrls,
          isPublished: form.isPublished
        });
        setMessage("Announcement posted.");
      }

      setForm(emptyForm);
      setActiveView("posted");
      await loadAnnouncements();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save announcement.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function editAnnouncement(announcement: Announcement) {
    setForm({
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      thumbnailUrl: announcement.thumbnail_url ?? "",
      imageUrlsText: extractImageUrls(announcement).join("\n"),
      isPublished: announcement.is_published
    });
    setActiveView("create");
    setSelectedAnnouncement(null);
  }

  async function removeAnnouncement(announcement: Announcement) {
    const shouldDelete = window.confirm(`Delete "${announcement.title || "Untitled announcement"}"?`);
    if (!shouldDelete) return;

    try {
      await deleteAnnouncement(announcement.id);
      setSelectedAnnouncement(null);
      setMessage("Announcement deleted.");
      await loadAnnouncements();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete announcement.");
    }
  }

  return (
    <section className="announcement-page">
      <div className="announcement-header">
        <div>
          <h2>Announcement Workspace</h2>
          <p>Prepare official notices and manage resident-facing updates.</p>
        </div>
        <div className="announcement-view-tabs">
          <button
            className={activeView === "create" ? "active" : ""}
            onClick={() => setActiveView("create")}
            type="button"
          >
            <Plus size={16} /> Create Announcement
          </button>
          <button
            className={activeView === "posted" ? "active" : ""}
            onClick={() => setActiveView("posted")}
            type="button"
          >
            <Megaphone size={16} /> Posted Announcements
          </button>
        </div>
      </div>

      {message ? (
        <div className="admin-message">
          <span>{message}</span>
          <button onClick={() => setMessage("")} type="button">Dismiss</button>
        </div>
      ) : null}

      {activeView === "create" ? (
        <CreateAnnouncementPanel
          form={form}
          isUploading={isUploading}
          isSubmitting={isSubmitting}
          onCancelEdit={() => setForm(emptyForm)}
          onChange={setForm}
          onGalleryUpload={handleGalleryUpload}
          onSubmit={handleSubmit}
          onThumbnailUpload={handleThumbnailUpload}
        />
      ) : (
        <PostedAnnouncementsPanel
          announcements={visibleAnnouncements}
          draftCount={draftCount}
          isLoading={isLoading}
          publishedCount={publishedCount}
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          totalCount={announcements.length}
          authorNames={authorNames}
          onDelete={removeAnnouncement}
          onEdit={editAnnouncement}
          onSearchChange={setSearchQuery}
          onStatusFilterChange={setStatusFilter}
          onView={setSelectedAnnouncement}
        />
      )}

      {selectedAnnouncement ? (
        <AnnouncementDetailsDialog
          announcement={selectedAnnouncement}
          author={announcementCreatorName(selectedAnnouncement, authorNames)}
          onClose={() => setSelectedAnnouncement(null)}
          onDelete={removeAnnouncement}
          onEdit={editAnnouncement}
          onImageView={setViewingImage}
        />
      ) : null}

      {viewingImage ? (
        <ImageViewer
          imageUrl={viewingImage.url}
          title={viewingImage.title}
          onClose={() => setViewingImage(null)}
        />
      ) : null}
    </section>
  );

  async function handleThumbnailUpload(file: File) {
    setIsUploading(true);
    setMessage("");

    try {
      const url = await uploadAnnouncementImage(file, "thumbnails");
      setForm((current) => ({ ...current, thumbnailUrl: url }));
      setMessage("Thumbnail uploaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to upload thumbnail.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleGalleryUpload(files: FileList) {
    const selectedFiles = Array.from(files).slice(0, 10);
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setMessage("");

    try {
      const urls = await Promise.all(
        selectedFiles.map((file) => uploadAnnouncementImage(file, "gallery"))
      );

      setForm((current) => {
        const existingUrls = parseImageUrls(current.imageUrlsText, "");
        const mergedUrls = Array.from(new Set([...existingUrls, ...urls]));
        return {
          ...current,
          thumbnailUrl: current.thumbnailUrl || urls[0] || "",
          imageUrlsText: mergedUrls.join("\n")
        };
      });
      setMessage(`${urls.length} announcement image${urls.length === 1 ? "" : "s"} uploaded.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to upload announcement images.");
    } finally {
      setIsUploading(false);
    }
  }
}

function CreateAnnouncementPanel({
  form,
  isUploading,
  isSubmitting,
  onCancelEdit,
  onChange,
  onGalleryUpload,
  onSubmit,
  onThumbnailUpload
}: {
  form: AnnouncementForm;
  isUploading: boolean;
  isSubmitting: boolean;
  onCancelEdit: () => void;
  onChange: (form: AnnouncementForm) => void;
  onGalleryUpload: (files: FileList) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onThumbnailUpload: (file: File) => void;
}) {
  return (
    <section className="announcement-panel">
      <PanelHeader
        icon={Edit3}
        title={form.id ? "Edit Announcement" : "Create Announcement"}
        subtitle="Prepare a notice with images and publish controls for residents."
      />
      <form className="announcement-form" onSubmit={onSubmit}>
        <label>
          Title
          <input
            value={form.title}
            onChange={(event) => onChange({ ...form, title: event.target.value })}
            placeholder="Enter announcement title"
          />
        </label>
        <label>
          Content
          <textarea
            value={form.content}
            onChange={(event) => onChange({ ...form, content: event.target.value })}
            placeholder="Write the official announcement details"
          />
        </label>
        <div className="announcement-form-grid">
          <label>
            Thumbnail URL
            <input
              value={form.thumbnailUrl}
              onChange={(event) => onChange({ ...form, thumbnailUrl: event.target.value })}
              placeholder="https://..."
            />
            <span className="file-upload-control">
              <input
                type="file"
                accept="image/*"
                disabled={isUploading || isSubmitting}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onThumbnailUpload(file);
                  event.target.value = "";
                }}
              />
              Upload thumbnail
            </span>
          </label>
          <label>
            Additional Image URLs
            <textarea
              value={form.imageUrlsText}
              onChange={(event) => onChange({ ...form, imageUrlsText: event.target.value })}
              placeholder="One image URL per line"
            />
            <span className="file-upload-control">
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={isUploading || isSubmitting}
                onChange={(event) => {
                  if (event.target.files) onGalleryUpload(event.target.files);
                  event.target.value = "";
                }}
              />
              Upload gallery images
            </span>
          </label>
        </div>
        {isUploading ? <p className="upload-status">Uploading image files...</p> : null}
        <div className="announcement-form-footer">
          <label className="publish-toggle">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(event) => onChange({ ...form, isPublished: event.target.checked })}
            />
            Publish immediately
          </label>
          {form.id ? (
            <button className="secondary-admin-button" onClick={onCancelEdit} type="button">
              Cancel Edit
            </button>
          ) : null}
          <button className="primary-admin-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Saving..." : form.id ? "Update Announcement" : "Post Announcement"}
          </button>
        </div>
      </form>
    </section>
  );
}

function PostedAnnouncementsPanel({
  announcements,
  authorNames,
  draftCount,
  isLoading,
  publishedCount,
  searchQuery,
  statusFilter,
  totalCount,
  onDelete,
  onEdit,
  onSearchChange,
  onStatusFilterChange,
  onView
}: {
  announcements: Announcement[];
  authorNames: Map<string, string>;
  draftCount: number;
  isLoading: boolean;
  publishedCount: number;
  searchQuery: string;
  statusFilter: string;
  totalCount: number;
  onDelete: (announcement: Announcement) => void;
  onEdit: (announcement: Announcement) => void;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onView: (announcement: Announcement) => void;
}) {
  return (
    <section className="announcement-panel posted-panel">
      <PanelHeader
        icon={Megaphone}
        title="Posted Announcements"
        subtitle="Browse, review, and manage all published or draft posts."
        trailing={`${totalCount} total`}
      />
      <div className="announcement-tools">
        <div className="announcement-stats">
          <span className="published">Published <strong>{publishedCount}</strong></span>
          <span className="draft">Drafts <strong>{draftCount}</strong></span>
        </div>
        <label className="resident-search">
          <Search size={17} />
          <input
            placeholder="Search announcements..."
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
      </div>
      <div className="filter-tabs compact-tabs">
        {[
          ["All Posts", "all"],
          ["Published", "published"],
          ["Drafts", "draft"]
        ].map(([label, value]) => (
          <button
            className={statusFilter === value ? "active" : ""}
            key={value}
            onClick={() => onStatusFilterChange(value)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <div className="announcement-list">
        {isLoading ? (
          <div className="empty-state">Loading announcements...</div>
        ) : announcements.length === 0 ? (
          <div className="empty-state">No announcements match this view.</div>
        ) : (
          announcements.map((announcement) => (
            <AnnouncementCard
              announcement={announcement}
              author={announcementCreatorName(announcement, authorNames)}
              key={announcement.id}
              onDelete={onDelete}
              onEdit={onEdit}
              onView={onView}
            />
          ))
        )}
      </div>
    </section>
  );
}

function AnnouncementCard({
  announcement,
  author,
  onDelete,
  onEdit,
  onView
}: {
  announcement: Announcement;
  author: string;
  onDelete: (announcement: Announcement) => void;
  onEdit: (announcement: Announcement) => void;
  onView: (announcement: Announcement) => void;
}) {
  const images = extractImageUrls(announcement);
  const thumbnail = announcement.thumbnail_url || images[0] || "";

  return (
    <article className="announcement-card" onClick={() => onView(announcement)}>
      <div className="announcement-thumb">
        {thumbnail ? <img src={thumbnail} alt="" /> : <ImageIcon size={30} />}
      </div>
      <div className="announcement-card-body">
        <div className="announcement-card-title">
          <h3>{announcement.title.trim() || "Untitled announcement"}</h3>
          <AnnouncementStatus isPublished={announcement.is_published} />
        </div>
        <p className="announcement-date">{formatDate(announcement.created_at)}</p>
        <p className="announcement-author">By: {author}</p>
        <p className="announcement-summary">
          {plainText(announcement.content) || "No announcement details available."}
        </p>
        <div className="announcement-card-actions" onClick={(event) => event.stopPropagation()}>
          <span>{images.length} photo{images.length === 1 ? "" : "s"}</span>
          <span>{announcement.updated_at ? "Updated" : "New post"}</span>
          <button onClick={() => onView(announcement)} type="button" aria-label="View announcement"><Eye size={18} /></button>
          <button onClick={() => onEdit(announcement)} type="button" aria-label="Edit announcement"><Edit3 size={18} /></button>
          <button className="danger-icon" onClick={() => onDelete(announcement)} type="button" aria-label="Delete announcement"><Trash2 size={18} /></button>
        </div>
      </div>
    </article>
  );
}

function AnnouncementDetailsDialog({
  announcement,
  author,
  onClose,
  onDelete,
  onEdit,
  onImageView
}: {
  announcement: Announcement;
  author: string;
  onClose: () => void;
  onDelete: (announcement: Announcement) => void;
  onEdit: (announcement: Announcement) => void;
  onImageView: (image: { title: string; url: string }) => void;
}) {
  const images = extractImageUrls(announcement);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="announcement-modal">
        <div className="modal-header">
          <div>
            <h2>{announcement.title.trim() || "Untitled announcement"}</h2>
            <p>By {author} • {formatDate(announcement.created_at)}</p>
          </div>
          <AnnouncementStatus isPublished={announcement.is_published} />
          <button onClick={onClose} type="button" aria-label="Close"><X size={20} /></button>
        </div>
        {images.length > 0 ? (
          <div className="announcement-modal-images">
            {images.map((image, index) => (
              <button
                key={image}
                onClick={() => onImageView({ title: `Announcement image ${index + 1}`, url: image })}
                type="button"
              >
                <img src={image} alt="Announcement attachment" />
              </button>
            ))}
          </div>
        ) : null}
        <div className="announcement-content-view">
          {plainText(announcement.content) || "No announcement details available."}
        </div>
        <div className="modal-actions">
          <button className="danger-admin-button" onClick={() => onDelete(announcement)} type="button">Delete</button>
          <button className="secondary-admin-button" onClick={() => onEdit(announcement)} type="button">Edit</button>
          <button className="primary-admin-button" onClick={onClose} type="button">Close</button>
        </div>
      </div>
    </div>
  );
}

function PanelHeader({
  icon: Icon,
  title,
  subtitle,
  trailing
}: {
  icon: typeof Megaphone;
  title: string;
  subtitle: string;
  trailing?: string;
}) {
  return (
    <div className="announcement-section-header">
      <span><Icon size={20} /></span>
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      {trailing ? <em>{trailing}</em> : null}
    </div>
  );
}

function AnnouncementStatus({ isPublished }: { isPublished: boolean }) {
  return (
    <span className={`announcement-status ${isPublished ? "published" : "draft"}`}>
      {isPublished ? "Published" : "Draft"}
    </span>
  );
}

function announcementCreatorName(announcement: Announcement, authorNames: Map<string, string>) {
  const storedName = announcement.created_by_name?.trim();
  if (storedName) return storedName;

  const creatorId = announcement.created_by?.trim() ?? "";
  return authorNames.get(creatorId) ?? "Barangay Admin";
}

function parseImageUrls(imageUrlsText: string, thumbnailUrl: string) {
  const urls = new Set<string>();
  const addUrl = (value: string) => {
    const url = value.trim();
    if (url) urls.add(url);
  };

  addUrl(thumbnailUrl);
  imageUrlsText.split(/\r?\n|,/).forEach(addUrl);

  return Array.from(urls);
}

function extractImageUrls(announcement: Announcement) {
  const urls = new Set<string>();
  const addUrl = (value: unknown) => {
    const url = value?.toString().trim();
    if (url) urls.add(url);
  };

  addUrl(announcement.thumbnail_url);

  if (Array.isArray(announcement.image_urls)) {
    announcement.image_urls.forEach(addUrl);
  } else if (typeof announcement.image_urls === "string") {
    announcement.image_urls.split(/\r?\n|,/).forEach(addUrl);
  }

  return Array.from(urls);
}

function plainText(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("[")) {
    try {
      const decoded = JSON.parse(trimmed) as unknown;
      if (Array.isArray(decoded)) {
        return decoded
          .map((operation) =>
            typeof operation === "object" &&
            operation !== null &&
            "insert" in operation
              ? String((operation as { insert: unknown }).insert)
              : ""
          )
          .join("")
          .trim();
      }
    } catch {
      // Fall through to markup cleanup.
    }
  }

  return trimmed
    .replace(/\[align=(left|center|right|justify)\]|\[\/align\]/gi, "")
    .replace(/\[size=\d+\]|\[\/size\]/gi, "")
    .replace(/\[\/?[bius]\]/gi, "")
    .trim();
}

function formatDate(value?: string) {
  if (!value) return "Not provided";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}
