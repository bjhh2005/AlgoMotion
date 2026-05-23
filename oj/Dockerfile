FROM gcc:latest

WORKDIR /workspace

RUN apt-get update && \
    apt-get install -y --no-install-recommends make && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p include checker  

COPY /tmp/Makefile .
COPY /tmp/include/ ./include/
COPY /tmp/checker/ ./checker/

RUN make

CMD ["sleep", "infinity"]