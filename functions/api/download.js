// Cloudflare R2 下载接口
// 依赖 wrangler 环境变量绑定 R2

export async function onRequest(context) {
  const { request, env } = context;
  // 你需要在 wrangler.toml 中绑定 R2 bucket，例如：
  // [[r2_buckets]]
  // binding = "MY_BUCKET"
  // bucket_name = "your-bucket-name"
  // preview_bucket_name = "your-bucket-name"

  // 获取文件名参数，例如 /api/download?file=your.exe
  const url = new URL(request.url);
  const fileName = url.searchParams.get("file");
  if (!fileName) {
    return new Response("Missing file parameter", { status: 400 });
  }

  // 从 R2 获取对象
  const object = await env.MY_BUCKET.get(fileName);
  if (!object) {
    return new Response("File not found", { status: 404 });
  }

  // 返回文件流
  return new Response(object.body, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename=\"${fileName}\"`,
    },
  });
}
