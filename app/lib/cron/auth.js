export function verifyCronAuth(request) {
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

export function unauthorizedCronResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
