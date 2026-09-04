import email
from email.message import EmailMessage

def parse_mime_email(raw_email_bytes: bytes) -> dict:
    """
    Parses raw MIME bytes into a structured dictionary.
    """
    msg = email.message_from_bytes(raw_email_bytes)
    
    result = {
        'headers': {
            'Subject': msg.get('Subject', ''),
            'From': msg.get('From', ''),
            'To': msg.get('To', '')
        },
        'body_text': '',
        'attachments': []
    }
    
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get('Content-Disposition'))
            
            if content_type == 'text/plain' and 'attachment' not in content_disposition:
                result['body_text'] += part.get_payload(decode=True).decode('utf-8', errors='replace')
            elif part.get_filename():
                result['attachments'].append({
                    'filename': part.get_filename(),
                    'mime_type': content_type,
                    'content': part.get_payload(decode=True)
                })
    else:
        result['body_text'] = msg.get_payload(decode=True).decode('utf-8', errors='replace')
        
    return result
