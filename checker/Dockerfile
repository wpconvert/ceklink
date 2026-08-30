FROM golang:1.25-alpine AS builder

WORKDIR /app

COPY go.mod ./

RUN go mod tidy

COPY . .

RUN go build -o checker .

FROM alpine:3.22

WORKDIR /app

COPY --from=builder /app/checker .

EXPOSE 8080

CMD ["./checker"]
