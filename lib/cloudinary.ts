// Replace these with your Cloudinary cloud name and unsigned upload preset
// Create an unsigned upload preset in: Cloudinary Dashboard → Settings → Upload → Upload presets
const CLOUD_NAME = "dabdgtb2n";
const UPLOAD_PRESET = "reili mobile app";

export async function uploadImageToCloudinary(
  localUri: string,
): Promise<string> {
  const formData = new FormData();
  formData.append("file", {
    uri: localUri,
    type: "image/jpeg",
    name: "trigger_image.jpg",
  } as any);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", "reili/triggers");

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData },
  );

  if (!res.ok) throw new Error("Image upload failed");
  const data = await res.json();
  return data.secure_url as string;
}
