import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  
  // Only handle specific dynamic content, not general pages
  // This prevents conflicts with existing static routes like /calculator, /report, /profile
  const allowedSlugs = ['api-docs', 'help', 'about']; // Add specific slugs as needed
  
  if (!allowedSlugs.includes(slug)) {
    return NextResponse.json(
      { message: 'Page not found' },
      { status: 404 }
    );
  }
  
  return NextResponse.json({ message: `Hello ${slug}!` });
}
