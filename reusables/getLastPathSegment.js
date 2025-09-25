const getLastPathSegment = (url) => {
  if (typeof url !== "string") return "";
  const cleanUrl = url.endsWith("/") ? url.slice(0, -1) : url;
  const parts = cleanUrl.split("/");
  return parts[parts.length - 1];
};

export default getLastPathSegment;
