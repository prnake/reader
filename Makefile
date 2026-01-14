.PHONY: build run test version

build:
	docker build . -t prnake/reader

run:
	docker run --rm -it -p 8080:8080 -p 8081:8081 prnake/reader

test:
	curl http://localhost:8081/https://arxiv.org/pdf/2511.01846v1

version:
	@echo "Current version: $$(git describe --tags --abbrev=0 2>/dev/null || echo '0.0.0')"
	@echo ""
	@echo "Select version bump type:"
	@echo "  1) major  ($$(git describe --tags --abbrev=0 2>/dev/null | awk -F. '{print $$1+1".0.0"}' || echo '1.0.0'))"
	@echo "  2) minor  ($$(git describe --tags --abbrev=0 2>/dev/null | awk -F. '{print $$1"."$$2+1".0"}' || echo '0.1.0'))"
	@echo "  3) patch  ($$(git describe --tags --abbrev=0 2>/dev/null | awk -F. '{print $$1"."$$2"."$$3+1}' || echo '0.0.1'))"
	@echo ""
	@read -p "Enter choice [1-3]: " choice; \
	case $$choice in \
		1) NEW_VER=$$(git describe --tags --abbrev=0 2>/dev/null | awk -F. '{print $$1+1".0.0"}' || echo '1.0.0') ;; \
		2) NEW_VER=$$(git describe --tags --abbrev=0 2>/dev/null | awk -F. '{print $$1"."$$2+1".0"}' || echo '0.1.0') ;; \
		3) NEW_VER=$$(git describe --tags --abbrev=0 2>/dev/null | awk -F. '{print $$1"."$$2"."$$3+1}' || echo '0.0.1') ;; \
		*) echo "Invalid choice"; exit 1 ;; \
	esac; \
	echo ""; \
	read -p "Confirm creating tag $$NEW_VER? [y/N] " confirm; \
	if [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ]; then \
		git tag -a $$NEW_VER -m "Release $$NEW_VER"; \
		echo "Tag $$NEW_VER created. Run 'git push origin $$NEW_VER' to push."; \
	else \
		echo "Cancelled."; \
	fi