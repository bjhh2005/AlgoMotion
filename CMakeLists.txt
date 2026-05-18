cmake_minimum_required(VERSION 3.10)
project(AlgoMotion LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(include external/json/include)

file(GLOB SOURCES src/*.cpp)

add_executable(algomotion ${SOURCES})

# MinGW ld 无法处理含中文的绝对路径，将 .a 复制到 build 目录后通过相对路径链接
add_custom_command(TARGET algomotion PRE_LINK
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${CMAKE_SOURCE_DIR}/external/json/lib/libjsoncpp.a"
        "${CMAKE_BINARY_DIR}/libjsoncpp.a"
)
target_link_options(algomotion PRIVATE -L.)
target_link_libraries(algomotion jsoncpp)
