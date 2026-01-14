.PHONY: build run test

build:
	docker build . -t prnake/reader

run:
	docker run --rm -it -p 8080:8080 -p 8081:8081 prnake/reader

test:
	curl http://localhost:8081/https://arxiv.org/pdf/2511.01846v1