#!/bin/bash
# 用法: ./judge.sh <run_id> <problem_id> <time_limit> <mem_limit>

RUN_ID=$1
PROB_ID=$2
TIME_LIMIT=$3
MEM_LIMIT=$4

BASE_DIR="/workspace/work/$RUN_ID"
DATA_DIR="/workspace/data/$PROB_ID"
CHECKER_PATH="/workspace/checker"
CONF_FILE="$DATA_DIR/.problemconf"

if [ ! -f "$CONF_FILE" ]; then
    echo "{\"status\": \"Config Error\", \"message\": \"找不到配置文件 .problemconf\"}"
    exit 1
fi

n_tests=0
input_suf="in"
output_suf="out"
use_builtin_judger="on"
use_builtin_checker=""

while IFS=' ' read -r key value; do
    [[ -z "$key" || "$key" =~ ^# ]] && continue
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    
    case "$key" in
        n_tests) n_tests="$value" ;;
        input_suf) input_suf="$value" ;;
        output_suf) output_suf="$value" ;;
        use_builtin_judger) use_builtin_judger="$value" ;;
        use_builtin_checker) use_builtin_checker="$value" ;;
    esac
done < "$CONF_FILE"

if ! cd "$BASE_DIR"; then
    echo "{\"status\": \"System Error\", \"message\": \"无法进入工作目录 $BASE_DIR\"}"
    exit 1
fi

g++ solution.cpp -o sol 2>compile.log
if [ $? -ne 0 ]; then
    error_msg=$(cat compile.log | tr '\n' ' ' | sed 's/"/\\"/g')
    echo "{\"status\": \"Compile Error\", \"total_cases\": 0, \"passed_cases\": 0, \"details\": [], \"error\": \"$error_msg\"}"
    exit 0
fi

TOTAL_CASES=0
PASSED_CASES=0
DETAILS_JSON=""
OVERALL_STATUS="Accepted"

CHECKER="$CHECKER_PATH/$use_builtin_checker"

json_file_string() {
    local file_path="$1"
    if [ ! -f "$file_path" ]; then
        printf '""'
        return
    fi
    awk '
        BEGIN { printf "\"" }
        {
            gsub(/\\/, "\\\\")
            gsub(/"/, "\\\"")
            gsub(/\r/, "\\r")
            gsub(/\t/, "\\t")
            if (NR > 1) printf "\\n"
            printf "%s", $0
        }
        END { printf "\"" }
    ' "$file_path"
}

mapfile -t IN_FILES < <(find "$DATA_DIR" -maxdepth 1 -name "*.$input_suf" -printf "%f\n" | sort | head -n "$n_tests")

for in_file_name in "${IN_FILES[@]}"; do
    TOTAL_CASES=$((TOTAL_CASES + 1))
    
    in_path="$DATA_DIR/$in_file_name"
    out_path="${in_path%.$input_suf}.$output_suf"
        
    ulimit -v $((MEM_LIMIT * 1024))

    start_time=$EPOCHREALTIME

    timeout "$TIME_LIMIT" ./sol < "$in_path" > temp.out 2>/dev/null
    exit_code=$?
    
    end_time=$EPOCHREALTIME
    duration=$(awk -v st="$start_time" -v et="$end_time" 'BEGIN {printf "%.3f", et - st}')

    CASE_STATUS="Accepted"
    if [ $exit_code -eq 124 ]; then
        CASE_STATUS="Time Limit Exceeded"
    elif [ $exit_code -ne 0 ]; then
        CASE_STATUS="Runtime Error"
    else
        if [ "$use_builtin_judger" == "on" ] && [ -n "$use_builtin_checker" ]; then
            "$CHECKER" "$in_path" temp.out "$out_path" > /dev/null 2>&1
            if [ $? -ne 0 ]; then
                CASE_STATUS="Wrong Answer"
            fi
        else
            diff -Z temp.out "$out_path" > /dev/null
            if [ $? -ne 0 ]; then
                CASE_STATUS="Wrong Answer"
            fi
        fi
    fi

    if [ "$CASE_STATUS" == "Accepted" ]; then
        PASSED_CASES=$((PASSED_CASES + 1))
    else
        if [ "$OVERALL_STATUS" == "Accepted" ]; then
            OVERALL_STATUS=$CASE_STATUS
        fi
    fi

    INPUT_JSON=$(json_file_string "$in_path")
    EXPECTED_JSON=$(json_file_string "$out_path")
    ACTUAL_JSON=$(json_file_string "temp.out")
    ITEM="{\"status\": \"$CASE_STATUS\", \"time\": $duration, \"input\": $INPUT_JSON, \"expected\": $EXPECTED_JSON, \"actual\": $ACTUAL_JSON}"
    if [ -z "$DETAILS_JSON" ]; then
        DETAILS_JSON="$ITEM"
    else
        DETAILS_JSON="$DETAILS_JSON, $ITEM"
    fi
done

echo "{\"status\": \"$OVERALL_STATUS\", \"total_cases\": $TOTAL_CASES, \"passed_cases\": $PASSED_CASES, \"details\": [$DETAILS_JSON]}"
