import { deletePrivateDocument, deletePublicDocument } from "./document-api";

export async function removePublicDocument(pathId: number) {
    return deletePublicDocument(pathId);
}

export async function removePrivateDocument(pathId: number) {
    return deletePrivateDocument(pathId);
}

