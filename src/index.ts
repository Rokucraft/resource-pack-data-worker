export interface Env {
  PACK_BUCKET: R2Bucket;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    switch (request.method) {
      case "GET": {
        const packs = (await env.PACK_BUCKET.list()).objects;
        if (packs.length === 0) {
          return new Response("No pack found", { status: 404 });
        }
        const latestPack = packs.reduce((max, cur) =>
          cur.uploaded > max.uploaded ? cur : max
        );
        const sha1 = await calculateSha1(env.PACK_BUCKET, latestPack.key);
        return Response.json({
          key: latestPack.key,
          sha1: sha1,
        });
      }
      default:
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            Allow: "GET",
          },
        });
    }
  },
};

async function calculateSha1(bucket: R2Bucket, key: string): Promise<string> {
  const object = await bucket.get(key);
  if (object == null) {
    return Promise.reject();
  }
  if (object.checksums.sha1) {
    return arrayBufferToHexString(object.checksums.sha1);
  }
  const sha1 = await crypto.subtle.digest("SHA-1", await object.arrayBuffer());
  bucket.put(key, object.body, {
    sha1,
  });
  return arrayBufferToHexString(sha1);
}

function arrayBufferToHexString(arrayBuffer: ArrayBuffer) {
  return [...new Uint8Array(arrayBuffer)]
    .map((int) => int.toString(16).padStart(2, "0"))
    .join("");
}
