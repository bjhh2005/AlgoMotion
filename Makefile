# AlgoMotion Makefile
# 依赖: g++ (C++11) 以上
# 如需使用 jsoncpp，取消注释 JSONCPP 相关行并将 JsonWriter.h 替换为 <json/json.h>

CXX      = g++
CXXFLAGS = -std=c++11 -Wall -Wextra -Iinclude
# JSONCPP_INC = -Iexternal/jsoncpp/include
# JSONCPP_LIB = -Lexternal/jsoncpp/lib -ljsoncpp
LDFLAGS  =
TARGET   = algomotion

SRCDIR   = src
OBJDIR   = obj

SOURCES  = $(wildcard $(SRCDIR)/*.cpp)
OBJECTS  = $(patsubst $(SRCDIR)/%.cpp, $(OBJDIR)/%.o, $(SOURCES))

.PHONY: all clean run

all: $(TARGET)

$(TARGET): $(OBJECTS)
	$(CXX) $(CXXFLAGS) -o $@ $^ $(LDFLAGS)

$(OBJDIR)/%.o: $(SRCDIR)/%.cpp
	@mkdir -p $(OBJDIR)
	$(CXX) $(CXXFLAGS) -c -o $@ $<

run: $(TARGET)
	./$(TARGET)

clean:
	rm -rf $(OBJDIR) $(TARGET)
