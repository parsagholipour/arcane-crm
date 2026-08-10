-- CreateIndex
CREATE INDEX "ShipmentTracking_post_delivery_due_idx" ON "ShipmentTracking"("subjectType", "status", "postDeliveryNotificationId", "deliveredAt");
