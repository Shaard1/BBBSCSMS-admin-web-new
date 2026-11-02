/* eslint-disable @next/next/no-img-element */
"use client";
import { AdminPageSkeleton } from "@/components/admin-page-skeleton";

import { Modal } from "@/components/modal";
import { useUnsavedChanges } from "@/components/use-unsaved-changes";
import {
  ArrowLeft,
  Bold,
  Edit3,
  Eye,
  ImageIcon,
  Italic,
  Palette,
  ChevronDown,
  List,
  ListOrdered,
  Link2,
  RemoveFormatting,
  Plus,
  Search,
  Trash2,
  Underline,
  X,
} from "@/components/crm-icons";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  createAnnouncement,
  deleteAnnouncement,
  fetchAnnouncements,
  fetchAuthorNamesByIds,
  sanitizeAnnouncementHtml,
  updateAnnouncement,
  uploadAnnouncementImage,
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
  isPublished: false,
};

const editorColors = ["#172033", "#0077d9", "#1f8a70", "#e4a000", "#b3261e"];

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [authorNames, setAuthorNames] = useState<Map<string, string>>(
    new Map(),
  );
  const [activeView, setActiveView] = useState<"create" | "posted">("posted");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAnnouncement, setSelectedAnnouncement] =
    useState<Announcement | null>(null);
  const [viewingImage, setViewingImage] = useState<{
    title: string;
    url: string;
  } | null>(null);
  const [form, setForm] = useState<AnnouncementForm>(emptyForm);
  const [showPreview, setShowPreview] = useState(false);
  const [savedForm, setSavedForm] = useState<AnnouncementForm>(emptyForm);
  const unsavedChanges = useUnsavedChanges(JSON.stringify(form) !== JSON.stringify(savedForm));
  const [message, setMessage] = useState("");
  const isSuccessMessage = /(?:uploaded|updated|deleted|removed|saved|published)\.$/i.test(message);
  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 8000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function loadAnnouncements() {
    setIsLoading(true);
    try {
      const data = await fetchAnnouncements();
      setAnnouncements(data);
      try {
        const names = await fetchAuthorNamesByIds(
          data.map((announcement) => announcement.created_by ?? ""),
        );
        setAuthorNames(names);
      } catch {
        setAuthorNames(new Map());
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load announcements.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAnnouncements();
  }, []);

  const publishedCount = announcements.filter(
    (item) => item.is_published,
  ).length;
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
      const target = !form.title.trim()
        ? document.querySelector<HTMLInputElement>('.announcement-form input[placeholder="Enter announcement title"]')
        : document.querySelector<HTMLElement>('[aria-label="Announcement content"]');
      target?.setAttribute("aria-invalid", "true");
      target?.focus();
      target?.scrollIntoView({ block: "center", behavior: "auto" });
      return;
    }

    if (isSubmitting || isUploading) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (form.isPublished || (submitter instanceof HTMLButtonElement && submitter.value === "preview")) {
      setMessage("");
      setShowPreview(true);
      return;
    }
    await saveAnnouncement();
  }

  async function saveAnnouncement() {
    if (isSubmitting || isUploading) return;
    setIsSubmitting(true);

    try {
      const imageUrls = parseImageUrls(form.imageUrlsText, form.thumbnailUrl);

      if (form.id) {
        await updateAnnouncement({
          id: form.id,
          title: form.title,
          content: form.content,
          thumbnailUrl: imageUrls[0] || "",
          imageUrls,
          isPublished: form.isPublished,
        });
        setMessage("Announcement updated.");
      } else {
        await createAnnouncement({
          title: form.title,
          content: form.content,
          thumbnailUrl: imageUrls[0] || "",
          imageUrls,
          isPublished: form.isPublished,
        });
        setMessage(
          form.isPublished ? "Announcement published." : "Draft saved.",
        );
      }

      setForm(emptyForm);
      setSavedForm(emptyForm);
      setShowPreview(false);
      setActiveView("posted");
      setStatusFilter(form.isPublished ? "published" : "draft");
      setSearchQuery("");
      await loadAnnouncements();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to save announcement.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function editAnnouncement(announcement: Announcement) {
    const initialForm = {
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      thumbnailUrl: announcement.thumbnail_url ?? "",
      imageUrlsText: extractImageUrls(announcement).join("\n"),
      isPublished: announcement.is_published,
    };
    setForm(initialForm);
    setSavedForm(initialForm);
    setActiveView("create");
    setSelectedAnnouncement(null);
  }

  async function removeAnnouncement(announcement: Announcement) {
    setIsDeleting(true);
    setDeleteError("");
    try {
      await deleteAnnouncement(announcement.id);
      setDeleteTarget(null);
      setSelectedAnnouncement(null);
      setMessage("Announcement deleted.");
      await loadAnnouncements();
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "Failed to delete announcement.",
      );
    } finally { setIsDeleting(false); }
  }

  if (isLoading) return <AdminPageSkeleton href="/admin/announcements" />;

  return (
    <section className="announcement-page">
      {activeView === "create" ? <button className="announcement-back" disabled={isSubmitting || isUploading} onClick={() => unsavedChanges.requestDiscard(() => { setForm(emptyForm); setSavedForm(emptyForm); setActiveView("posted"); })} type="button"><ArrowLeft size={18}/> Back to announcement library</button> : null}
      {activeView === "create" ? <header className="announcement-header">
        <div className="announcement-heading-copy">
          <h2>{form.id ? "Edit announcement" : "New announcement"}</h2>
          <p>Prepare your message, then save a draft or publish it.</p>
        </div>

      </header> : null}

      {message ? (
        <div className="announcement-toast" role="status" aria-live="polite" aria-atomic="true">
          <span className={"announcement-toast-icon" + (isSuccessMessage ? " success" : "")} aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isSuccessMessage ? <path d="m5 12 4 4L19 6" /> : <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>}
            </svg>
          </span>
          <span className="announcement-toast-message">{message}</span>
          <button onClick={() => setMessage("")} type="button" aria-label="Dismiss notification">
            <X size={18} />
          </button>
        </div>
      ) : null}

      {activeView === "create" ? (
        <CreateAnnouncementPanel
          form={form}
          isUploading={isUploading}
          pendingImages={pendingImages}
          isSubmitting={isSubmitting}
          onCancelEdit={() => unsavedChanges.requestDiscard(() => {
            setForm(emptyForm);
            setSavedForm(emptyForm);
            setActiveView("posted");
          })}
          onChange={setForm}
          onGalleryRemove={handleGalleryRemove}
          onGalleryUpload={handleGalleryUpload}
          onSubmit={handleSubmit}
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
          onDelete={(announcement) => { setDeleteError(""); setDeleteTarget(announcement); }}
          onEdit={(announcement) => unsavedChanges.requestDiscard(() => editAnnouncement(announcement))}
          onCreate={() => setActiveView("create")}
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
          onDelete={(announcement) => { setDeleteError(""); setDeleteTarget(announcement); }}
          onEdit={(announcement) => unsavedChanges.requestDiscard(() => editAnnouncement(announcement))}
          onImageView={setViewingImage}
        />
      ) : null}

      {deleteTarget ? <Modal title="Delete announcement" dismissible={!isDeleting} onClose={() => setDeleteTarget(null)}>
        <div className="reject-modal">
          <div className="modal-header"><div><h2>Delete announcement?</h2><p>{deleteTarget.title || "Untitled announcement"}</p></div><button type="button" aria-label="Close delete confirmation" disabled={isDeleting} onClick={() => setDeleteTarget(null)}><X size={20} /></button></div>
          <p>This permanently removes the announcement. This cannot be undone.</p>
          {deleteError ? <p className="admin-message" role="alert">{deleteError}</p> : null}
          <div className="modal-actions"><button type="button" disabled={isDeleting} onClick={() => setDeleteTarget(null)}>Cancel</button><button type="button" className="danger-admin-button" disabled={isDeleting} onClick={() => void removeAnnouncement(deleteTarget)}>{isDeleting ? "Deleting…" : "Delete announcement"}</button></div>
        </div>
      </Modal> : null}

      {unsavedChanges.showConfirmation ? (
        <Modal title="Discard unsaved changes?" onClose={unsavedChanges.cancelDiscard}>
          <div className="announcement-modal">
            <div className="modal-header"><h2>Discard unsaved changes?</h2></div>
            <p>Your announcement changes have not been saved. Keep editing to avoid losing them.</p>
            <div className="modal-actions">
              <button type="button" autoFocus onClick={unsavedChanges.cancelDiscard}>Keep editing</button>
              <button type="button" onClick={unsavedChanges.confirmDiscard}>Discard changes</button>
            </div>
          </div>
        </Modal>
      ) : null}

      {showPreview ? (
        <Modal title={form.isPublished ? "Review before publishing" : "Draft preview"} onClose={() => { if (!isSubmitting) setShowPreview(false); }}>
          <div className="announcement-modal">
            <div className="modal-header"><div><h2>{form.isPublished ? "Review before publishing" : "Draft preview"}</h2><p>{form.isPublished ? "This announcement will be visible in the resident app." : "Review your announcement before saving."}</p></div></div>
            <h3>{form.title}</h3>
            {parseImageUrls(form.imageUrlsText, form.thumbnailUrl).map((url, index) => <img className="announcement-publish-image" key={url} src={url} alt={`Announcement attachment ${index + 1}`} />)}
            <div className="announcement-content-view rich-content-view" dangerouslySetInnerHTML={{ __html: richContentHtml(form.content) }} />
            {message ? <p role="alert">{message}</p> : null}
            <div className="modal-actions">
              <button type="button" disabled={isSubmitting} onClick={() => setShowPreview(false)}>Back to editing</button>
              <button type="button" className="primary-admin-button" disabled={isSubmitting} onClick={() => void saveAnnouncement()}>{isSubmitting ? "Saving…" : form.isPublished ? "Confirm publication" : "Save draft"}</button>
            </div>
          </div>
        </Modal>
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

  async function handleGalleryUpload(files: FileList) {
    const remaining = Math.max(0, 10 - parseImageUrls(form.imageUrlsText, form.thumbnailUrl).length);
    const selectedFiles = Array.from(files).slice(0, remaining);
    if (selectedFiles.length === 0) { setMessage("You can add up to 10 gallery images. Remove one before adding another."); return; }

    setPendingImages(selectedFiles.map(file => file.name));
    setIsUploading(true);
    setMessage("");

    try {
      const urls = await Promise.all(
        selectedFiles.map((file) => uploadAnnouncementImage(file, "gallery")),
      );

      setForm((current) => {
        const existingUrls = parseImageUrls(current.imageUrlsText, current.thumbnailUrl);
        const mergedUrls = Array.from(new Set([...existingUrls, ...urls]));
        return {
          ...current,
          thumbnailUrl: mergedUrls[0] || "",
          imageUrlsText: mergedUrls.join("\n"),
        };
      });
      setMessage(
        `${urls.length} announcement image${urls.length === 1 ? "" : "s"} uploaded.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to upload announcement images.",
      );
    } finally {
      setPendingImages([]);
      setIsUploading(false);
    }
  }

  function handleGalleryRemove(imageUrl: string) {
    setForm((current) => {
      const remainingUrls = parseImageUrls(current.imageUrlsText, current.thumbnailUrl).filter(
        (url) => url !== imageUrl,
      );
      return {
        ...current,
        imageUrlsText: remainingUrls.join("\n"),
        thumbnailUrl: remainingUrls[0] || "",
      };
    });
    setMessage("Gallery image removed.");
  }
}

function CreateAnnouncementPanel({
  form,
  pendingImages,
  isUploading,
  isSubmitting,
  onCancelEdit,
  onChange,
  onGalleryRemove,
  onGalleryUpload,
  onSubmit,
}: {
  form: AnnouncementForm;
  pendingImages: string[];
  isUploading: boolean;
  isSubmitting: boolean;
  onCancelEdit: () => void;
  onChange: (form: AnnouncementForm) => void;
  onGalleryRemove: (imageUrl: string) => void;
  onGalleryUpload: (files: FileList) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const galleryImages = parseImageUrls(form.imageUrlsText, form.thumbnailUrl);

  return (
    <section className="announcement-panel announcement-composer">
      <form className="announcement-form" onSubmit={onSubmit} onInput={event => {
        if (event.target instanceof HTMLElement) event.target.removeAttribute("aria-invalid");
      }}>
        <div className="announcement-writing">
        <h3>Message</h3>
        <label>
          Title
          <input
            aria-required="true"
            value={form.title}
            onChange={(event) =>
              onChange({ ...form, title: event.target.value })
            }
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
        </div>
        <aside className="announcement-media-grid" aria-label="Announcement images">
          <section className="announcement-media-card">
            <div className="announcement-media-heading"><div><h3>Images</h3><span>The first image is your cover photo.</span></div><span className="announcement-image-count">{galleryImages.length + pendingImages.length}/10</span></div>
            <p className="announcement-image-guidance">JPG, PNG or WebP. Up to 5 MB per image.</p>
            <div className={"announcement-gallery-preview " + (galleryImages.length || pendingImages.length ? "" : "empty")}>
              {galleryImages.map((imageUrl,index)=>(
                <div className="announcement-gallery-tile" key={imageUrl}>
                  <img src={imageUrl} alt={index===0 ? "Cover image" : "Announcement image " + (index+1)}/>
                  {index===0?<span className="announcement-cover-badge">Cover</span>:null}
                  <button type="button" className="announcement-remove-image" disabled={isUploading || isSubmitting} onClick={()=>onGalleryRemove(imageUrl)} aria-label={"Remove gallery image " + (index+1)} title="Remove image"><X size={16}/></button>
                </div>
              ))}
              {pendingImages.map((name,index)=>(
                <div className="announcement-gallery-tile announcement-upload-tile" key={"upload-"+index} role="status" aria-label={"Uploading " + name}>
                  <span className="announcement-upload-spinner" aria-hidden="true" />
                </div>
              ))}
              {!galleryImages.length && !pendingImages.length ? <div><ImageIcon size={28}/><span>No images added</span></div> : null}
            </div>
            <span className="file-upload-control"><input type="file" aria-label="Upload announcement images" accept="image/jpeg,image/png,image/webp" multiple disabled={isUploading || isSubmitting} onChange={event=>{if(event.target.files)onGalleryUpload(event.target.files);event.target.value="";}}/>{galleryImages.length?"Add images":"Upload images"}</span>
          </section>
        </aside>
        <div className="announcement-form-footer">
          <label className="publish-toggle">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(event) =>
                onChange({ ...form, isPublished: event.target.checked })
              }
            />
            <span>Publish to residents<small>Leave off to save a draft.</small></span>
          </label>
          <button className="secondary-admin-button" type="submit" name="intent" value="preview" disabled={isSubmitting || isUploading}><Eye size={18}/> Preview</button>
          {form.id ? (
            <button
              className="secondary-admin-button"
              onClick={onCancelEdit}
              type="button"
            >
              Cancel Edit
            </button>
          ) : null}
          <button
            className="primary-admin-button"
            disabled={isSubmitting || isUploading}
            type="submit"
          >
            {isSubmitting
              ? "Saving…"
              : form.isPublished
                ? "Publish announcement"
                : "Save draft"}
          </button>
        </div>
      </form>
    </section>
  );
}

function RichTextEditor({
  onChange,
  placeholder,
  value,
}: {
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const changeFrameRef = useRef<number | null>(null);
  const selectionRef = useRef<Range | null>(null);
  const [formatting, setFormatting] = useState({bold:false,italic:false,underline:false,bullet:false,numbered:false});
  const colorMenuRef = useRef<HTMLDetailsElement>(null);
  const linkMenuRef = useRef<HTMLDetailsElement>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  useEffect(() => {
    function dismiss(event: PointerEvent) {
      for (const menu of [colorMenuRef.current, linkMenuRef.current]) {
        if (menu && !menu.contains(event.target as Node)) menu.open = false;
      }
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);

  useEffect(() => {
    function trackSelection() {
      const selection = document.getSelection();
      if (!selection?.rangeCount || !editorRef.current?.contains(selection.anchorNode)) return;
      selectionRef.current = selection.getRangeAt(0).cloneRange();
      setFormatting({bold:document.queryCommandState("bold"),italic:document.queryCommandState("italic"),underline:document.queryCommandState("underline"),bullet:document.queryCommandState("insertUnorderedList"),numbered:document.queryCommandState("insertOrderedList")});
    }
    document.addEventListener("selectionchange",trackSelection);
    return () => document.removeEventListener("selectionchange",trackSelection);
  }, []);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = sanitizeAnnouncementHtml(value);
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
    const range = selectionRef.current;
    if (range && editorRef.current?.contains(range.commonAncestorContainer)) {
      const selection = document.getSelection();
      selection?.removeAllRanges(); selection?.addRange(range);
    }
    document.execCommand(command, false, commandValue);
    const updatedSelection = document.getSelection();
    if (updatedSelection?.rangeCount) selectionRef.current = updatedSelection.getRangeAt(0).cloneRange();
    setFormatting({bold:document.queryCommandState("bold"),italic:document.queryCommandState("italic"),underline:document.queryCommandState("underline"),bullet:document.queryCommandState("insertUnorderedList"),numbered:document.queryCommandState("insertOrderedList")});
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
      <div
        className="rich-editor-toolbar"
        aria-label="Announcement formatting tools"
      >
        <button
          type="button"
          title="Bold"
          aria-label="Bold"
          aria-pressed={formatting.bold}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand("bold")}
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          title="Italic"
          aria-label="Italic"
          aria-pressed={formatting.italic}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand("italic")}
        >
          <Italic size={16} />
        </button>
        <button
          type="button"
          title="Underline"
          aria-label="Underline"
          aria-pressed={formatting.underline}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand("underline")}
        >
          <Underline size={16} />
        </button>
        <details className="editor-popover" ref={colorMenuRef} onKeyDown={event => { if(event.key === "Escape") { event.currentTarget.open=false; event.currentTarget.querySelector("summary")?.focus(); } }}>
          <summary title="Text color" aria-label="Text color"><Palette size={16}/> <span>Text color</span><ChevronDown size={12}/></summary>
          <div className="editor-color-menu">
            <span className="editor-menu-label">Text color</span>
            <div className="editor-color-options">
              {editorColors.map(color => <button key={color} type="button" title={color} aria-label={"Use " + color + " text color"} onMouseDown={event=>event.preventDefault()} onClick={()=>{runCommand("foreColor",color);if(colorMenuRef.current)colorMenuRef.current.open=false;}} style={{backgroundColor:color}}/>)}
            </div>
            <label className="editor-custom-color">Custom color<input type="color" aria-label="Announcement text color" defaultValue={editorColors[1]} onChange={event=>runCommand("foreColor",event.target.value)}/></label>
          </div>
        </details>
        <button type="button" aria-label="Bulleted list" title="Bulleted list" aria-pressed={formatting.bullet} onMouseDown={event=>event.preventDefault()} onClick={()=>runCommand("insertUnorderedList")}><List size={18}/></button>
        <button type="button" aria-label="Numbered list" title="Numbered list" aria-pressed={formatting.numbered} onMouseDown={event=>event.preventDefault()} onClick={()=>runCommand("insertOrderedList")}><ListOrdered size={18}/></button>
        <details className="editor-popover" ref={linkMenuRef} onKeyDown={event=>{if(event.key==="Escape"){event.currentTarget.open=false;event.currentTarget.querySelector("summary")?.focus();}}}>
          <summary aria-label="Insert link" title="Insert link"><Link2 size={18}/></summary>
          <div className="editor-link-menu">
            <label htmlFor="announcement-link-url">Link address</label>
            <input id="announcement-link-url" type="url" placeholder="https://example.com" value={linkUrl} onChange={event=>{setLinkUrl(event.target.value);setLinkError("");}} onKeyDown={event=>{if(event.key==="Enter")event.preventDefault();}}/>
            {linkError ? <span role="alert">{linkError}</span> : null}
            <button type="button" onClick={()=>{
              let url: URL;
              try { url=new URL(linkUrl); if(!["https:","http:"].includes(url.protocol))throw new Error(); }
              catch { setLinkError("Enter a valid http or https address.");return; }
              if(!selectionRef.current || selectionRef.current.collapsed){setLinkError("Select the text you want to link first.");return;}
              runCommand("createLink",url.href); if(linkMenuRef.current)linkMenuRef.current.open=false;setLinkUrl("");
            }}>Apply link</button>
            <button type="button" onClick={()=>{runCommand("unlink");if(linkMenuRef.current)linkMenuRef.current.open=false;}}>Remove link</button>
          </div>
        </details>
        <button type="button" aria-label="Clear formatting" title="Clear formatting" onMouseDown={event=>event.preventDefault()} onClick={()=>{runCommand("removeFormat");runCommand("unlink");}}><RemoveFormatting size={18}/></button>
      </div>
      <div
        className="rich-editor-surface"
        contentEditable
        data-placeholder={placeholder}
        onInput={handleInput}
        ref={editorRef}
        role="textbox"
        aria-label="Announcement content"
        aria-multiline="true"
        aria-required="true"
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
  onCreate,
  onDelete,
  onEdit,
  onSearchChange,
  onStatusFilterChange,
  onView,
}: {
  announcements: Announcement[];
  authorNames: Map<string, string>;
  draftCount: number;
  isLoading: boolean;
  publishedCount: number;
  searchQuery: string;
  statusFilter: string;
  totalCount: number;
  onCreate: () => void;
  onDelete: (announcement: Announcement) => void;
  onEdit: (announcement: Announcement) => void;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onView: (announcement: Announcement) => void;
}) {
  return (
    <section className="announcement-panel posted-panel" aria-label="Announcement library">
      <div className="announcement-tools">
      <div className="filter-tabs compact-tabs">
        {[
          ["All Posts", "all"],
          ["Published", "published"],
          ["Drafts", "draft"],
        ].map(([label, value]) => (
          <button
            aria-label={label}
            aria-pressed={statusFilter === value}
            className={statusFilter === value ? "active" : ""}
            key={value}
            onClick={() => onStatusFilterChange(value)}
            type="button"
          >
            {label} <span className="announcement-filter-count">{value === "all" ? totalCount : value === "published" ? publishedCount : draftCount}</span>
          </button>
        ))}
      </div>
        <div className="announcement-library-actions">
        <label className="resident-search">
          <Search size={17} />
          <input
            aria-label="Search announcements"
            placeholder="Search announcements…"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
        <button className="primary-admin-button" onClick={onCreate} type="button"><Plus size={18}/> Write announcement</button>
        </div>
      </div>
      <div className="announcement-list">
        {announcements.length === 0 && !isLoading ? (
          <div className="empty-state">
            <strong>{totalCount === 0 ? "No announcements yet" : "No matching announcements"}</strong>
            <p>{totalCount === 0 ? "Choose Write announcement to prepare your first resident update." : "Try another search or select All Posts to see more results."}</p>
          </div>
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
  onView,
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
    <article className="announcement-card">
      <button className="announcement-card-open" type="button" aria-label={`Open announcement: ${announcement.title.trim() || "Untitled announcement"}`} onClick={() => onView(announcement)} />
      <div className="announcement-thumb">
        {thumbnail ? <img src={thumbnail} alt="" /> : <ImageIcon size={30} />}
      </div>
      <div className="announcement-card-body">
        <div className="announcement-card-title">
          <h3>{announcement.title.trim() || "Untitled announcement"}</h3>
          <AnnouncementStatus isPublished={announcement.is_published} />
        </div>
        <p className="announcement-meta"><time dateTime={announcement.created_at}>{formatDate(announcement.created_at)}</time><span>By {author}</span><span>{images.length} photo{images.length === 1 ? "" : "s"}</span></p>
        <p className="announcement-summary">
          {plainText(announcement.content) ||
            "No announcement details available."}
        </p>
        <div
          className="announcement-card-actions"
          onClick={(event) => event.stopPropagation()}
        >

<button
            onClick={() => onEdit(announcement)}
            type="button"
            title="Edit announcement"
            aria-label="Edit announcement"
          >
            <Edit3 size={18} />
          </button>
          <button
            className="danger-icon"
            onClick={() => onDelete(announcement)}
            type="button"
            title="Delete announcement"
            aria-label="Delete announcement"
          >
            <Trash2 size={18} />
          </button>
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
  onImageView,
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
    <Modal title="Announcement preview" onClose={onClose}>
      <div
        className="announcement-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2>{announcement.title.trim() || "Untitled announcement"}</h2>
            <p>
              By {author} • {formatDate(announcement.created_at)}
            </p>
          </div>
          <AnnouncementStatus isPublished={announcement.is_published} />
          <button onClick={onClose} type="button" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {images.length > 0 ? (
          <div className="announcement-modal-images">
            {images.map((image, index) => (
              <button
                key={image}
                onClick={() =>
                  onImageView({
                    title: `Announcement image ${index + 1}`,
                    url: image,
                  })
                }
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
            __html:
              richContentHtml(announcement.content) ||
              "No announcement details available.",
          }}
        />
        <div className="modal-actions">
          <button
            className="danger-admin-button"
            onClick={() => onDelete(announcement)}
            type="button"
          >
            Delete
          </button>
          <button
            className="secondary-admin-button"
            onClick={() => onEdit(announcement)}
            type="button"
          >
            Edit
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AnnouncementStatus({ isPublished }: { isPublished: boolean }) {
  return (
    <span
      className={`status-badge announcement-status ${isPublished ? "published" : "draft"}`}
    >
      {isPublished ? "Published" : "Draft"}
    </span>
  );
}

function announcementCreatorName(
  announcement: Announcement,
  authorNames: Map<string, string>,
) {
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
              : "",
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
  if (!trimmed.includes("<"))
    return escapeHtml(trimmed).replace(/\n/g, "<br />");

  return sanitizeAnnouncementHtml(trimmed);
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
    year: "numeric",
  });
}
