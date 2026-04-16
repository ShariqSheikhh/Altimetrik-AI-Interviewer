import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    console.log(`\n================= [FRONTEND LOG] =================`);
    console.log(`[Timestamp]:`, new Date().toISOString());
    console.log(`[Level]:`, data.level || 'INFO');
    console.log(`[Message]:`, data.message);
    if (data.details && Object.keys(data.details).length > 0) {
      console.log(`[Details]:\n`, JSON.stringify(data.details, null, 2));
    }
    console.log(`==================================================\n`);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false });
  }
}
