from email.message import EmailMessage
from email.utils import make_msgid

def create_mime_email(sender: str, recipients: list, subject: str, body_text: str, attachments: list = None) -> bytes:
    """
    Constructs a MIME multipart email from structured data.
    attachments: list of dicts [{'filename': '...', 'content': b'...', 'mime_type': '...'}]
    """
    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = sender
    msg['To'] = ", ".join(recipients)
    msg['Message-ID'] = make_msgid()
    
    msg.set_content(body_text)
    
    if attachments:
        for att in attachments:
            maintype, subtype = att['mime_type'].split('/', 1) if '/' in att['mime_type'] else ('application', 'octet-stream')
            msg.add_attachment(
                att['content'], 
                maintype=maintype, 
                subtype=subtype, 
                filename=att['filename']
            )
            
    return msg.as_bytes()
