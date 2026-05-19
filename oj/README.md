## FastAPI 接口

`GET  /api/judge`

### 接口定义:
```py
#函数命名
async def run_judge(req: JudgeRequest)

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

### 接口触发
提交OJ时触发