/* eslint-disable @next/next/no-img-element */
"use client";

import {
  Bold,
  Edit3,
  Eye,
  ImageIcon,
  Italic,
  Megaphone,
  Palette,
  Plus,
  Search,
  Trash2,
  Underline,
  X
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  createAnnouncement,
  deleteAnnouncement,
  fetchAnnouncements,
  fetchAuthorNamesByIds,
  updateAnnouncement,
  uploadAnnouncementImage
} from "@/lib/announcements";
import { AdminLoadingOverlay } from "@/components/admin-loading-overlay";
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

const editorColors = ["#172033", "#0077d9", "#1f8a70", "#e4a000", "#b3261e"];

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

    if (!form.title.trim() || !plainText(form.content).trim()) {
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
          onGalleryRemove={handleGalleryRemove}
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
      {isLoading ? <AdminLoadingOverlay label="Loading announcements..." /> : null}

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

  function handleGalleryRemove(imageUrl: string) {
    setForm((current) => {
      const remainingUrls = parseImageUrls(current.imageUrlsText, "").filter((url) => url !== imageUrl);
      return {
        ...current,
        imageUrlsText: remainingUrls.join("\n")
      };
    });
    setMessage("Gallery image removed.");
  }
}

function CreateAnnouncementPanel({
  form,
  isUploading,
  isSubmitting,
  onCancelEdit,
  onChange,
  onGalleryRemove,
  onGalleryUpload,
  onSubmit,
  onThumbnailUpload
}: {
  form: AnnouncementForm;
  isUploading: boolean;
  isSubmitting: boolean;
  onCancelEdit: () => void;
  onChange: (form: AnnouncementForm) => void;
  onGalleryRemove: (imageUrl: string) => void;
  onGalleryUpload: (files: FileList) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onThumbnailUpload: (file: File) => void;
}) {
  const galleryImages = parseImageUrls(form.imageUrlsText, "");

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
        <div className="announcement-field">
          Content
          <RichTextEditor
            value={form.content}
            placeholder="Write the official announcement details"
            onChange={(content) => onChange({ ...form, content })}
          />
        </div>
        <div className="announcement-media-grid">
          <section className="announcement-media-card">
            <div className="announcement-media-heading">
              <div>
                <h4>Thumbnail image</h4>
                <span>Shown in the announcement list</span>
              </div>
              <em>Main image</em>
            </div>
            <p className="announcement-image-guidance">
              Recommended landscape sizes: 1920x1080, 1600x900, or 1366x768.
            </p>
            <div className={`announcement-thumbnail-preview ${form.thumbnailUrl ? "" : "empty"}`}>
              {form.thumbnailUrl ? (
                <img src={form.thumbnailUrl} alt="" />
              ) : (
                <div>
                  <ImageIcon size={30} />
                  <span>No thumbnail selected</span>
                </div>
              )}
            </div>
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
              {form.thumbnailUrl ? "Replace thumbnail" : "Upload thumbnail"}
            </span>
          </section>
          <section className="announcement-media-card">
            <div className="announcement-media-heading">
              <div>
                <h4>Gallery images</h4>
                <span>Optional photos shown in details</span>
              </div>
              <em>{galleryImages.length} image{galleryImages.length === 1 ? "" : "s"}</em>
            </div>
            <p className="announcement-image-guidance">
              Use landscape images when possible: 1920x1080, 1600x900, or 1366x768.
            </p>
            <div className={`announcement-gallery-preview ${galleryImages.length > 0 ? "" : "empty"}`}>
              {galleryImages.length > 0 ? (
                galleryImages.map((imageUrl, index) => (
                  <article className="announcement-gallery-tile" key={imageUrl}>
                    <img src={imageUrl} alt={`Gallery image ${index + 1}`} />
                    <div className="announcement-gallery-tile-bar">
                      <span>Image {index + 1}</span>
                      <button
                        type="button"
                        className="announcement-remove-image"
                        onClick={() => onGalleryRemove(imageUrl)}
                        aria-label={`Remove gallery image ${index + 1}`}
                      >
                        <Trash2 size={15} />
                        Remove
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div>
                  <ImageIcon size={28} />
                  <span>No gallery images yet</span>
                </div>
              )}
            </div>
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
          </section>
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

function RichTextEditor({
  onChange,
  placeholder,
  value
}: {
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const changeFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  useEffect(() => {
    return () => {
      if (changeFrameRef.current != null) {
        window.cancelAnimationFrame(changeFrameRef.current);
      }
    };
  }, []);

  function runCommand(command: string, commandValue?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    commitEditorChange();
  }

  function commitEditorChange() {
    onChange(editorRef.current?.innerHTML ?? "");
  }

  function handleInput() {
    if (changeFrameRef.current != null) return;

    changeFrameRef.current = window.requestAnimationFrame(() => {
      changeFrameRef.current = null;
      commitEditorChange();
    });
  }

  return (
    <div className="rich-editor">
      <div className="rich-editor-toolbar" aria-label="Announcement formatting tools">
        <button type="button" aria-label="Bold" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("bold")}>
          <Bold size={16} />
        </button>
        <button type="button" aria-label="Italic" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("italic")}>
          <Italic size={16} />
        </button>
        <button type="button" aria-label="Underline" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("underline")}>
          <Underline size={16} />
        </button>
        <label className="rich-editor-color" aria-label="Text color">
          <Palette size={16} />
          <input
            type="color"
            defaultValue={editorColors[1]}
            onChange={(event) => runCommand("foreColor", event.target.value)}
          />
        </label>
        <div className="rich-editor-swatches" aria-label="Quick text colors">
          {editorColors.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Use ${color} text color`}
              onClick={() => runCommand("foreColor", color)}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
      <div
        className="rich-editor-surface"
        contentEditable
        data-placeholder={placeholder}
        onInput={handleInput}
        ref={editorRef}
        role="textbox"
        aria-multiline="true"
        suppressContentEditableWarning
      />
    </div>
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
        {announcements.length === 0 && !isLoading ? (
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
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="announcement-modal" onClick={(event) => event.stopPropagation()}>
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
        <div
          className="announcement-content-view rich-content-view"
          dangerouslySetInnerHTML={{
            __html: richContentHtml(announcement.content) || "No announcement details available."
          }}
        />
        <div className="modal-actions">
          <button className="danger-admin-button" onClick={() => onDelete(announcement)} type="button">Delete</button>
          <button className="secondary-admin-button" onClick={() => onEdit(announcement)} type="button">Edit</button>
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
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\[align=(left|center|right|justify)\]|\[\/align\]/gi, "")
    .replace(/\[size=\d+\]|\[\/size\]/gi, "")
    .replace(/\[\/?[bius]\]/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function richContentHtml(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return "";
  if (!trimmed.includes("<")) return escapeHtml(trimmed).replace(/\n/g, "<br />");

  return trimmed
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/\s(href|src)="javascript:[^"]*"/gi, "")
    .replace(/\s(href|src)='javascript:[^']*'/gi, "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
