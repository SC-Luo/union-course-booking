import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getPrivateKey() {
  return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
}

export function getAdminDb() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getPrivateKey();
  const hasServiceAccount = Boolean(projectId && clientEmail && privateKey);
  const hasApplicationCredentials = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);

  if (!hasServiceAccount && !hasApplicationCredentials) {
    return null;
  }

  if (!getApps().length) {
    initializeApp({
      credential: hasServiceAccount
        ? cert({
            projectId,
            clientEmail,
            privateKey,
          })
        : applicationDefault(),
      projectId,
    });
  }

  return getFirestore();
}
