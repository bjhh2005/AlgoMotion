#!/bin/bash
# 用法: ./inner_judge.sh <run_id> <problem_id> <time_limit> <mem_limit>

RUN_ID=$1
PROB_ID=$2
TIME_LIMIT=$3
MEM_LIMIT=$4

BASE_DIR="/workspace/$RUN_ID"
mkdir -p $BASE_DIR
cd $BASE_DIR

g++ solution.cpp -o sol 2>compile.log
if [ $? -ne 0 ]; then
    echo "COMPILE_ERROR"
    exit 0
fi

DATA_DIR="/data/$PROB_ID"
for in_file in $DATA_DIR/*.in; do
    out_file="${in_file%.in}.out"
    ulimit -v $((MEM_LIMIT * 1024))
    timeout $TIME_LIMIT ./sol < "$in_file" > temp.out 2>/dev/null
    res=$?

    if [ $res -eq 124 ]; then echo "TIME_LIMIT_EXCEEDED"; exit 0; fi
    if [ $res -ne 0 ]; then echo "RUNTIME_ERROR"; exit 0; fi
    
    diff -Z temp.out "$out_file" > /dev/null
    if [ $? -ne 0 ]; then echo "WRONG_ANSWER"; exit 0; fi
done

echo "ACCEPTED"