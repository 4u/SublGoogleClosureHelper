

import sublime
import sublime_plugin
import os
import commands
import string
import subprocess
from subprocess import Popen

class GctCreatemethodCommand(sublime_plugin.TextCommand):
	def run(self, edit):
		os.environ["PATH"] = '/usr/local/bin:' + os.environ["PATH"]
		view = sublime.active_window().active_view()

		# Walk through each region in the selection  
		for region in view.sel():  
			# Only interested in empty regions, otherwise they may span multiple  
			# lines, which doesn't make sense for this command.  
			if region.empty():  
				# Expand the region to the full line it resides on, excluding the newline  
				line = view.line(region)  

				# Extract the string for the line, and add a newline  
				lineContents = view.substr(line)  
				filename = view.file_name()

				dirname = string.replace(os.path.dirname(os.path.abspath(__file__)), " ", "\\ ")
				binfile = dirname + "/closure-helper/bin/createmethod"
				cmd = binfile + " -f \"" + filename + "\" -c \"" + string.replace(lineContents, '"', '\\"') + "\""
				result, err = Popen([cmd], bufsize=-1, stdout=subprocess.PIPE, stderr=subprocess.PIPE, stdin=subprocess.PIPE, shell=True).communicate(self.view.substr(self.view.sel()[0]).encode('utf-8'))
				
				# print result
				# print err
				self.view.erase(edit, line)
				self.view.run_command("insert_snippet", {"contents": result})
