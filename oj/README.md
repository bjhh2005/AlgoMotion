# OJ指南

## 声明
- OJ仅供娱乐
- 目前仅支持传统题目配置
- 校验器来自 UOJ

## 运行

## FastAPI 接口

`POST /api/judge`

#### 接口定义:
```py
#函数命名
def run_judge(req: JudgeRequest)

#传入参数 JudgeRequest, 定义如下:
class JudgeRequest(BaseModel):
    submission_id: str #提交id
    problem_id: str    #题目id
    code: str          #用户提交代码
    time_limit: int    #时间限制:秒
    mem_limit: int     #空间限制:MB
'''
示例json
{
  "submission_id": "114514",
  "problem_id": "1001",
  "code": "#include <iostream>\nint main(){int x, y;std::cin>>x>>y;std::cout<<x+y; return 0;}",
  "time_limit": 2,
  "mem_limit": 256
}
'''

#返回参数如下:
class Ret:
    status: str        #题目状态值(Accepted, ...)
    total_cases: int   #判例个数
    passed_cases: int  #通过个数
    details: list      #判例详情
    '''
    details 内容格式:
    statue: str        #判例状态
    time: double       #判例用时
    '''
'''
示例json
{
  "status": "Accepted",
  "total_cases": 2,
  "passed_cases": 2,
  "details": [
    {
      "status": "Accepted",
      "time": 0.005282163619995117
    },
    {
      "status": "Accepted",
      "time": 0.004642963409423828
    }
  ]
}
'''
```

#### 接口触发
提交OJ请求时触发

## 数据设置

题目数据应放置在 `/data` 文件夹下, 一道题目的所有数据都应放置在以题目id命名的文件夹下 (如 `/data/1001` ).

在每道题目的数据文件夹内需要一个名为 `.problemconf` 的文本文件, 该文件的格式如下:

```
#.problemconf

n_tests                   #测试用例总数
input_suf                 #输入文件的后缀名
output_suf                #输出文件的后缀名
use_builtin_judger        #是否使用内置测评器, 默认为on
use_builtin_checker       #使用哪种内置校验器
                          #结尾必须有一行空行
```

一个示例如下:

```
n_tests 10
input_suf in
output_suf out
use_builtin_judger on
use_builtin_checker ncmp

```

这将会在当前文件夹下寻找所有以 `.in` 为后缀结尾的文件, 并使用前 `10` 个文件作为输入进行评测, 被评测代码的输出会和与输入文件前缀同名的 `.out` 文件进行对比, 对比校验器为 `ncmp`. **注意: 你的每一对测试用例的前缀名需要完全相同.**

## 内置校验器

|校验器|功能|
|------|----|
|`ncmp`|（单行整数序列）比较有序64位整数序列|
|`wcmp`|（单行字符串序列）比较字符串序列|
|`fcmp`|（多行数据）逐行进行全文比较，**不忽略行末空格**，忽略文末回车。|
|`icmp`|比较单个整数|
|`ncmp`|（单行整数序列）比较有序64位整数序列|
|`uncmp`|（单行整数序列）比较无序64位整数序列，即排序后比较|
|`acmp`或`rcmp`|比较单个双精度浮点数，最大绝对误差为 1.5e-6|
|`dcmp`|比较单个双精度浮点数，最大绝对或相对误差为 1.0e-6|
|`rcmp4`|比较双精度浮点数序列，最大绝对或相对误差为 1.0e-4|
|`rcmp6`|比较双精度浮点数序列，最大绝对或相对误差为 1.0e-6|
|`rcmp9`|比较双精度浮点数序列，最大绝对或相对误差为 1.0e-9|
|`rncmp`|比较双精度浮点数序列，最大绝对误差为 1.5e-5|
|`hcmp`|比较单个有符号大整数|
|`lcmp`|逐行逐字符串进行全文比较，多个空白字符视为一个|
|`caseicmp`|多组数据，比较单个整数，输出形如：`Case <caseNumber>: <number>`|
|`casencmp`|多组数据，比较整数序列，输出形如：`Case <caseNumber>: <number> <number> ... <number>`|
|`casewcmp`|多组数据，比较字符串序列，输出形如：`Case <caseNumber>: <token> <token> ... <token>`|
|`yesno`|比较单个`YES`和`NO`|