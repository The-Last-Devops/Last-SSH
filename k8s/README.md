# Kubernetes Deploy

## 1. Tạo imagePullSecret để pull từ GHCR private

```bash
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=<github-username> \
  --docker-password=<github-personal-access-token> \
  --docker-email=<your-email>
```

> Tạo PAT tại: GitHub → Settings → Developer settings → Personal access tokens → New token  
> Scope cần chọn: `read:packages`

## 2. Apply manifests

```bash
kubectl apply -f k8s/
```

## 3. Hoặc đổi image thành public (đơn giản hơn)

GitHub → Packages → `last-ssh` → Package settings → **Change visibility → Public**

Sau đó xóa `imagePullSecrets` trong `deployment.yaml`.
