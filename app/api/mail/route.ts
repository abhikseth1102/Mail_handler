import { NextRequest, NextResponse } from 'next/server';
import net from 'net';

function sendTcpCommand(socket: net.Socket, command: string, payload: Buffer | string): Promise<{verb: string, payload: Buffer}> {
  return new Promise((resolve, reject) => {
    const payloadBuffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf-8');
    const header = `${command} ${payloadBuffer.length}\r\n`;
    
    socket.removeAllListeners('data');
    socket.removeAllListeners('error');
    
    let headerStr = '';
    let isHeaderComplete = false;
    let expectedLength = 0;
    let verb = '';
    let payloadChunks: Buffer[] = [];
    let receivedLength = 0;

    socket.on('data', (data) => {
      if (!isHeaderComplete) {
        const str = data.toString('utf-8');
        const newlineIdx = str.indexOf('\r\n');
        
        if (newlineIdx !== -1) {
          headerStr += str.substring(0, newlineIdx);
          isHeaderComplete = true;
          
          const parts = headerStr.split(' ');
          verb = parts[0];
          expectedLength = parseInt(parts[1] || '0', 10);
          
          const remainingData = data.subarray(newlineIdx + 2);
          payloadChunks.push(remainingData);
          receivedLength += remainingData.length;
        } else {
          headerStr += str;
        }
      } else {
        payloadChunks.push(data);
        receivedLength += data.length;
      }
      
      if (isHeaderComplete && receivedLength >= expectedLength) {
        const fullPayload = Buffer.concat(payloadChunks).subarray(0, expectedLength);
        resolve({ verb, payload: fullPayload });
      }
    });

    socket.on('error', (err) => reject(err));
    socket.write(header);
    socket.write(payloadBuffer);
  });
}

function buildMime(sender: string, recipients: string[], subject: string, bodyText: string, attachments: any[]): Buffer {
    const boundary = "----=_Part_" + Date.now();
    let mime = `Subject: ${subject}\r\n`;
    mime += `From: ${sender}\r\n`;
    mime += `To: ${recipients.join(', ')}\r\n`;
    mime += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
    
    mime += `--${boundary}\r\n`;
    mime += `Content-Type: text/html; charset="utf-8"\r\n\r\n`;
    mime += `${bodyText}\r\n\r\n`;
    
    if (attachments && attachments.length > 0) {
        for (const att of attachments) {
            mime += `--${boundary}\r\n`;
            mime += `Content-Type: ${att.mimeType || 'application/octet-stream'}; name="${att.filename}"\r\n`;
            mime += `Content-Disposition: attachment; filename="${att.filename}"\r\n`;
            mime += `Content-Transfer-Encoding: base64\r\n\r\n`;
            // Remove data:image/png;base64, prefix if present
            const base64Data = att.contentBase64.includes(',') ? att.contentBase64.split(',')[1] : att.contentBase64;
            mime += `${base64Data}\r\n\r\n`;
        }
    }
    
    mime += `--${boundary}--\r\n`;
    return Buffer.from(mime, 'utf-8');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { command, payload, username, password, jwt } = body;
    
    const client = new net.Socket();
    
    const tcpHost = process.env.TCP_HOST || '127.0.0.1';
    const tcpPort = parseInt(process.env.TCP_PORT || '5000', 10);
    
    await new Promise<void>((resolve, reject) => {
      client.connect(tcpPort, tcpHost, () => resolve());
      client.on('error', (err) => reject(err));
    });

    try {
        if (['SEND_EMAIL', 'GET_INBOX', 'GET_EMAIL', 'DELETE_EMAIL'].includes(command)) {
          if (!jwt) {
            throw new Error("Missing JWT token for authenticated command");
          }
          const authRes = await sendTcpCommand(client, 'AUTH', jwt);
          if (authRes.verb !== '200') {
             throw new Error("Invalid or expired JWT session");
          }
        }

        let finalPayloadBuffer: Buffer;
        
        if (command === 'SEND_EMAIL') {
           finalPayloadBuffer = buildMime(
               username, 
               payload.recipients, 
               payload.subject, 
               payload.bodyText, 
               payload.attachments
           );
        } else {
           finalPayloadBuffer = Buffer.from(payload || '', 'utf-8');
        }

        const res = await sendTcpCommand(client, command, finalPayloadBuffer);
        
        // Convert response payload to JSON if it's GET_INBOX or GET_EMAIL
        let responseData: any = res.payload.toString('utf-8');
        if (['GET_INBOX', 'GET_EMAIL'].includes(command) && res.verb === '200') {
           try { responseData = JSON.parse(responseData); } catch (e) {}
        }

        return NextResponse.json({ verb: res.verb, payload: responseData });
    } finally {
        client.destroy();
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
