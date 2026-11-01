"use client";
import { ProfilePhotoEditor } from "@/components/profile-photo-editor";
import Image from "next/image";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { officeRoleLabel } from "@/lib/roles";
import { notificationPreferenceKey, notificationPreferenceEvent } from "@/lib/account-preferences";

export default function SettingsPage() {
  const [account, setAccount] = useState<{id:string;name:string;email:string;role:string} | null>(null);
  const [editingPhoto, setEditingPhoto] = useState<File | null>(null);
  const [hasPhoto, setHasPhoto] = useState(true);
  const [photoVersion, setPhotoVersion] = useState(0);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const [profileName, setProfileName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [badges, setBadges] = useState(true);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const {data:{user},error:authError}=await supabase.auth.getUser();
        if(authError || !user) throw new Error("Unable to load your account. Please sign in again.");
        const {data,error:profileError}=await supabase.from("profiles").select("full_name, role").eq("id",user.id).maybeSingle();
        if(profileError) throw new Error("Unable to load your profile. Refresh to try again.");
        if(cancelled)return;
        setAccount({id:user.id,name:data?.full_name || user.user_metadata?.full_name || "Office user",email:user.email || "",role:officeRoleLabel(data?.role === "admin" ? "admin" : "staff")});
        setProfileName(data?.full_name || user.user_metadata?.full_name || "");
        try { setBadges(localStorage.getItem(notificationPreferenceKey(user.id)) !== "off"); }
        catch { setError("Browser preferences are unavailable. Your account still works normally."); }
      } catch(error) { if(!cancelled)setError(error instanceof Error?error.message:"Unable to load settings."); }
    }
    void load();
    return () => {cancelled=true;};
  },[]);
  async function updatePhoto(file?: File) {
    if(savingPhoto)return;
    if(file && (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size>2*1024*1024)) {setError("Choose a JPG, PNG or WebP image under 2 MB.");return;}
    setSavingPhoto(true);setError("");setMessage("");
    try {
      const form=new FormData(); if(file)form.set("file",file);
      const response=await fetch("/api/admin/profile/photo",{method:file?"POST":"DELETE",body:file?form:undefined});
      const result=await response.json();if(!response.ok)throw new Error(result.message);
      setHasPhoto(Boolean(file));setPhotoVersion(Date.now());
      window.dispatchEvent(new CustomEvent("bc-photo-updated",{detail:{hasPhoto:Boolean(file)}}));
      setMessage(file?"Profile photo updated.":"Profile photo removed.");
      return true;
    } catch(error) {setError(error instanceof Error?error.message:"Unable to update your photo.");return false;}
    finally {setSavingPhoto(false);if(photoInput.current)photoInput.current.value="";}
  }
  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (savingProfile || !account) return;
    setSavingProfile(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/profile", {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({fullName:profileName})});
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to save your profile.");
      setAccount({...account,name:result.fullName}); setProfileName(result.fullName);
      window.dispatchEvent(new CustomEvent("bc-profile-updated",{detail:{fullName:result.fullName}}));
      setMessage("Profile updated.");
    } catch (error) {setError(error instanceof Error ? error.message : "Unable to save your profile.");}
    finally {setSavingProfile(false);}
  }
  async function changePassword(event:FormEvent) {
    event.preventDefault();
    if(busy)return;
    setMessage("");setError("");
    if(password !== confirmation){setError("Passwords do not match.");return;}
    setBusy(true);
    try {
      const {error}=await supabase.auth.updateUser({password});
      if(error)throw error;
      setPassword("");setConfirmation("");setMessage("Password updated.");
    } catch(error){setError(error instanceof Error?error.message:"Unable to update your password.");}
    finally {setBusy(false);}
  }
  function saveBadges(enabled:boolean) {
    if(!account)return;
    try {
      localStorage.setItem(notificationPreferenceKey(account.id),enabled?"on":"off");
      setBadges(enabled);window.dispatchEvent(new Event(notificationPreferenceEvent));
      setMessage("Notification preference saved for this browser.");setError("");
    } catch {setError("Unable to save preferences in this browser.");}
  }
  return <div className="workspace-page account-settings">
    {editingPhoto?<ProfilePhotoEditor file={editingPhoto} onCancel={()=>setEditingPhoto(null)} onApply={async file=>(await updatePhoto(file))===true}/>:null}
    <header className="settings-intro"><h2>Your account</h2><p>A space for your profile, sign-in details, and preferences.</p></header>
    {error?<p role="alert" className="settings-feedback">{error}</p>:null}
    {message?<p role="status" className="settings-feedback">{message}</p>:null}
    {!account&&!error?<p role="status">Loading settings…</p>:null}
    {account?<div className="settings-layout">
      <div className="settings-content">
      <section id="profile-section" className="settings-section" aria-labelledby="profile-heading"><div><h2 id="profile-heading">Profile</h2><p>Update your photo and name as they appear in the workspace.</p></div><form onSubmit={saveProfile}><div className="settings-photo">
        <span className="settings-photo-preview">{hasPhoto ? <Image unoptimized width={64} height={64} src={"/api/admin/profile/photo?v="+photoVersion} alt="Your profile photo" onError={()=>setHasPhoto(false)}/> : account.name.slice(0,1).toUpperCase()}</span>
        <div><div className="settings-photo-actions"><button type="button" disabled={savingPhoto} onClick={()=>photoInput.current?.click()}>{savingPhoto?"Updating…":hasPhoto?"Change photo":"Upload photo"}</button>{hasPhoto?<button type="button" disabled={savingPhoto} onClick={()=>void updatePhoto()}>Remove photo</button>:null}</div><small>JPG, PNG or WebP. Up to 2 MB.</small></div>
        <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose profile photo" hidden onChange={event=>{const file=event.target.files?.[0];if(file){if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>2*1024*1024){setError("Choose a JPG, PNG or WebP image under 2 MB.");}else{setError("");setEditingPhoto(file);}event.target.value="";}}}/>
      </div><label>Full name<input autoComplete="name" required minLength={2} maxLength={120} value={profileName} onChange={event=>setProfileName(event.target.value)} disabled={savingProfile}/></label><dl><div><dt>Email</dt><dd>{account.email}</dd></div><div><dt>Role</dt><dd>{account.role}</dd></div></dl><button className="primary-admin-button" type="submit" disabled={savingProfile || profileName.trim()===account.name}>{savingProfile?"Saving…":"Save profile"}</button></form></section>
      <section id="security-section" className="settings-section" aria-labelledby="security-heading"><div><h2 id="security-heading">Password</h2><p>Use a unique password with at least 8 characters.</p></div><form onSubmit={changePassword}><label>New password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={event=>setPassword(event.target.value)} disabled={busy}/></label><label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirmation} onChange={event=>setConfirmation(event.target.value)} disabled={busy}/></label><button className="primary-admin-button" disabled={busy} type="submit">{busy?"Updating…":"Update password"}</button></form></section>
      <section id="notifications-section" className="settings-section" aria-labelledby="notifications-heading"><div><h2 id="notifications-heading">Notifications</h2><p>Preferences apply to this account in this browser.</p></div><label className="settings-toggle"><input type="checkbox" checked={badges} onChange={event=>saveBadges(event.target.checked)}/><span>Show unread count on the notification bell<small>Notifications remain available when the count is hidden.</small></span></label></section>
      </div>
    </div>:null}
  </div>;
}
