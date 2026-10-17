/**
 * 훈련 기록 → 월별 Google Docs 저장용 Apps Script.
 * 설정 방법은 docs/google-docs-setup.md 를 본다.
 *
 * 스크립트 속성(프로젝트 설정 → 스크립트 속성)에 SECRET 을 넣어 둔다.
 * 앱 설정의 "비밀 키"와 같아야 저장된다.
 */

const FOLDER_NAME = '훈련 기록';

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    const props = PropertiesService.getScriptProperties();
    const secret = props.getProperty('SECRET');
    if (!secret || req.secret !== secret) return json({ ok: false, error: 'unauthorized' });
    if (req.action === 'ping') return json({ ok: true });

    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.date || '') || !req.title || typeof req.text !== 'string') {
      return json({ ok: false, error: 'bad request' });
    }
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const doc = monthDoc(req.date.slice(0, 7), props);
      writeSection(doc, `${req.date} · ${req.title}`, req.text);
      doc.saveAndClose();
      return json({ ok: true, url: doc.getUrl() });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// "훈련 기록 2026-10" 문서. 없으면 "훈련 기록" 폴더 안에 만든다.
function monthDoc(month, props) {
  const key = `DOC_${month}`;
  const id = props.getProperty(key);
  if (id) {
    try { return DocumentApp.openById(id); } catch (err) { /* 지워졌으면 새로 만든다 */ }
  }
  const doc = DocumentApp.create(`${FOLDER_NAME} ${month}`);
  const file = DriveApp.getFileById(doc.getId());
  folder().addFile(file);
  DriveApp.getRootFolder().removeFile(file);
  doc.getBody().getParagraphs()[0].setText(`${FOLDER_NAME} ${month}`).setHeading(DocumentApp.ParagraphHeading.TITLE);
  props.setProperty(key, doc.getId());
  return doc;
}

function folder() {
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}

// 같은 날짜·같은 훈련 제목이 이미 있으면 그 자리를 새 내용으로 바꾼다. 없으면 맨 아래에 붙인다.
function writeSection(doc, heading, text) {
  const body = doc.getBody();
  const H = DocumentApp.ParagraphHeading;
  let index = -1;
  for (let i = 0; i < body.getNumChildren(); i++) {
    const el = body.getChild(i);
    if (el.getType() === DocumentApp.ElementType.PARAGRAPH && el.asParagraph().getHeading() === H.HEADING1 && el.asParagraph().getText() === heading) {
      index = i;
      break;
    }
  }
  if (index >= 0) {
    // 다음 HEADING1 직전까지 지운다.
    while (index < body.getNumChildren()) {
      const el = body.getChild(index);
      const isNextSection = el.getType() === DocumentApp.ElementType.PARAGRAPH
        && el.asParagraph().getHeading() === H.HEADING1
        && el.asParagraph().getText() !== heading;
      if (isNextSection) break;
      if (index === body.getNumChildren() - 1) {
        // 문서의 마지막 문단은 지울 수 없으므로 비운다.
        if (el.getType() === DocumentApp.ElementType.PARAGRAPH) el.asParagraph().setText('').setHeading(H.NORMAL);
        else el.removeFromParent();
        break;
      }
      el.removeFromParent();
    }
  } else {
    index = body.getNumChildren();
  }

  let at = index;
  body.insertParagraph(at++, heading).setHeading(H.HEADING1);
  // 첫 줄은 앱의 제목 줄이라 건너뛴다.
  text.split('\n').slice(1).forEach((line) => {
    const p = body.insertParagraph(at++, line);
    p.setHeading(line.startsWith('■') ? H.HEADING3 : H.NORMAL);
  });
}

// 편집기에서 한 번 실행해 권한을 승인하고 동작을 확인하는 용도.
function testWrite() {
  const props = PropertiesService.getScriptProperties();
  const doc = monthDoc(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM'), props);
  writeSection(doc, '연결 테스트', '[연결 테스트]\n이 섹션은 지워도 됩니다.');
  doc.saveAndClose();
  Logger.log(doc.getUrl());
}
