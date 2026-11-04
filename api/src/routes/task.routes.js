import { Router } from "express";
import multer from "multer";
import { createTaskController } from "../controllers/task.controller.js";

const upload = multer({
    storage: multer.memoryStorage(),
    defParamCharset: "utf8",
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
        fields: 0,
        parts: 1
    }
});

export function createTaskRouter(taskService) {
    const router = Router();
    const controller = createTaskController(taskService);

    router.get("/", controller.list);
    router.post("/", controller.create);
    router.get("/:id/attachments", controller.listAttachments);
    router.post("/:id/attachments", upload.single("archivo"), controller.createAttachment);
    router.get("/:id/attachments/:attachmentId", controller.getAttachment);
    router.delete("/:id/attachments/:attachmentId", controller.deleteAttachment);
    router.post("/:id/archivar", controller.archive);
    router.post("/:id/restaurar", controller.restore);
    router.get("/:id", controller.get);
    router.put("/:id", controller.update);
    router.delete("/:id", controller.delete);

    return router;
}
