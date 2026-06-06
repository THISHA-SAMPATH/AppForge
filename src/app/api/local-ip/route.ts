import { NextResponse } from "next/server";
import os from "os";

export async function GET() {
  try {
    const interfaces = os.networkInterfaces();
    let localIp = "127.0.0.1";

    for (const interfaceName of Object.keys(interfaces)) {
      const addresses = interfaces[interfaceName];
      if (addresses) {
        for (const addressInfo of addresses) {
          // Look for an IPv4 address that is not internal/loopback
          if (addressInfo.family === "IPv4" && !addressInfo.internal) {
            localIp = addressInfo.address;
            break;
          }
        }
      }
      if (localIp !== "127.0.0.1") {
        break;
      }
    }

    return NextResponse.json({ ip: localIp });
  } catch (error) {
    console.error("GET /api/local-ip error:", error);
    return NextResponse.json(
      { error: "Failed to detect local IP" },
      { status: 500 }
    );
  }
}
