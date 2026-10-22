import { test, expect } from "@playwright/test";
import { resolvePrivateFiles } from "../lib/private-files";

const baseUrl = "https://storage.example.test";
const locator = `${baseUrl}/storage/v1/object/public/resident-files/owner/id%20front.jpg`;

test("private evidence is signed once per read and stored records are unchanged", async () => {
  const calls: string[] = [];
  const original = [{ id_image_front: locator, image_urls: JSON.stringify([locator]), full_name: "Fixture" }];
  const resolved = await resolvePrivateFiles(original, {
    baseUrl,
    sign: async (bucket, path) => { calls.push(`${bucket}/${path}`); return "https://signed.example.test/evidence"; },
  });
  expect(calls).toEqual(["resident-files/owner/id front.jpg"]);
  expect(resolved[0].id_image_front).toBe("https://signed.example.test/evidence");
  expect(resolved[0].image_urls).toEqual(["https://signed.example.test/evidence"]);
  expect(original[0].id_image_front).toBe(locator);
  expect(original[0].image_urls).toBe(JSON.stringify([locator]));
});

test("denied evidence never falls back to its public locator", async () => {
  const resolved = await resolvePrivateFiles([{ image_url: locator }], {
    baseUrl, sign: async () => { throw new Error("Access denied"); },
  });
  expect(resolved[0].image_url).toBe("");
});

test("public announcement images and external fixture images are not signed", async () => {
  const records = [{ image_url: `${baseUrl}/storage/v1/object/public/announcement-files/poster.jpg` },
    { image_url: "https://example.test/fixture.png" }];
  const resolved = await resolvePrivateFiles(records, {
    baseUrl, sign: async () => { throw new Error("Should not sign public content"); },
  });
  expect(resolved).toEqual(records);
});

test("existing expiring links are re-signed from their object path", async () => {
  const resolved = await resolvePrivateFiles([{
    image_urls: [`${baseUrl}/storage/v1/object/sign/report-images/owner/photo.jpg?token=expired`],
  }], { baseUrl, sign: async (bucket, path) => `${bucket}/${path}` });
  expect(resolved[0].image_urls).toEqual(["report-images/owner/photo.jpg"]);
});
