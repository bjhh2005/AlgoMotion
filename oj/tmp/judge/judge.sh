#!/bin/bash
# 用法: ./judge.sh <run_id> <problem_id> <time_limit> <mem_limit>

RUN_ID=$1
PROB_ID=$2
TIME_LIMIT=$3
MEM_LIMIT=$4
BASE_DIR="/workspace/$RUN_ID"
DATA_DIR="/data/$PROB_ID"

cd $BASE_DIR

g++ solution.cpp -o sol 2>compile.log
if [ $? -ne 0 ]; then
    echo "{\"status\": \"Compile Error\", \"total_cases\": 0, \"passed_cases\": 0, \"details\": []}"
    exit 0
fi

TOTAL_CASES=0
PASSED_CASES=0
DETAILS_JSON=""
OVERALL_STATUS="Accepted"

for in_file in $(ls $DATA_DIR/*.in 2>/dev/null | sort); do
    TOTAL_CASES=$((TOTAL_CASES + 1))
    out_file="${in_file%.in}.out"
    
    start_time=$(date +%s.%N)
    
    ulimit -v $((MEM_LIMIT * 1024))
    timeout $TIME_LIMIT ./sol < "$in_file" > temp.out 2>/dev/null
    exit_code=$?
    
    end_time=$(date +%s.%N)
    duration=$(echo "$end_time - $start_time" | awk '{printf "%.6f", $1}')

    CASE_STATUS="Accepted"
    if [ $exit_code -eq 124 ]; then
        CASE_STATUS="Time Limit Exceeded"
    elif [ $exit_code -ne 0 ]; then
        CASE_STATUS="Runtime Error"
    else
        diff -Z temp.out "$out_file" > /dev/null
        if [ $? -ne 0 ]; then
            CASE_STATUS="Wrong Answer"
        fi
    fi

    if [ "$CASE_STATUS" == "Accepted" ]; then
        PASSED_CASES=$((PASSED_CASES + 1))
    else
        if [ "$OVERALL_STATUS" == "Accepted" ]; then
            OVERALL_STATUS=$CASE_STATUS
        fi
    fi

    ITEM="{\"status\": \"$CASE_STATUS\", \"time\": $duration}"
    if [ -z "$DETAILS_JSON" ]; then
        DETAILS_JSON="$ITEM"
    else
        DETAILS_JSON="$DETAILS_JSON, $ITEM"
    fi
done

echo "{\"status\": \"$OVERALL_STATUS\", \"total_cases\": $TOTAL_CASES, \"passed_cases\": $PASSED_CASES, \"details\": [$DETAILS_JSON]}"