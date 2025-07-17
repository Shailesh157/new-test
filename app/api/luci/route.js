export async function GET(params) {
  return new Response(
    JSON.stringify({
      msg: "Hello, world!",
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
